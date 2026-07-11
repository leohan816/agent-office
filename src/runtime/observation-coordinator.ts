import { LocalArtifactSource } from '../adapters/observations/artifacts/source.js';
import { LocalGitObservationSource } from '../adapters/observations/git/source.js';
import { LocalMissionManifestSource } from '../adapters/observations/manifest/source.js';
import {
  NodeReadonlyToolRunner,
  type ReadonlyToolRunner,
} from '../adapters/observations/process-runner.js';
import { LocalTmuxObservationSource } from '../adapters/observations/tmux/source.js';
import { ObservationError, observationErrorCode } from '../adapters/observations/errors.js';
import type {
  ArtifactObservation,
  GitRepositoryObservation,
  MissionManifestObservation,
  TmuxPaneObservation,
} from '../adapters/observations/ports.js';
import {
  evaluateFreshness,
  type ObservationPresentation,
} from '../application/hosts/freshness.js';
import type { MissionProjection } from '../application/projections/mission-projector.js';
import { createLocalProjectRegistry } from '../application/projects/registry.js';
import type { DashboardEvidenceInput, DashboardObservationInput } from '../application/queries/dashboard-view-model.js';
import type { DurableAlertProjection } from '../application/alerts/index.js';
import { DomainError } from '../contracts/types.js';
import type { EventEnvelope } from '../domain/events/index.js';
import type { MissionManifest } from '../domain/manifest/index.js';
import type { RoleSceneProjection, SceneAlertSeverity, SceneConnectionState } from '../ui/scene/types.js';
import type {
  OperationalRuntimeConfiguration,
  RuntimeActorRegistration,
} from './operational-config.js';

interface SourceFailure {
  readonly errorCode: string;
}

type SourceResult<T> = { readonly value: T } | SourceFailure;

export interface RuntimeActorObservation {
  readonly roleInstanceId: string;
  readonly stationId: RuntimeActorRegistration['stationId'];
  readonly actorRole: string;
  readonly projectId: string;
  readonly hostId: string;
  readonly presentation: ObservationPresentation;
  readonly connectionState: SceneConnectionState;
  readonly reasonCode: string;
  readonly observedAt?: string;
  readonly evidenceRefs: readonly string[];
}

export interface RuntimeObservationSnapshot {
  readonly schemaVersion: 'agent-office.runtime-observation-snapshot.v1';
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly refreshedAt: string;
  readonly refreshSequence: number;
  readonly manifest: MissionManifestObservation;
  readonly actors: Readonly<Record<string, RuntimeActorObservation>>;
  readonly artifacts: Readonly<Record<string, ArtifactObservation>>;
}

export interface RuntimeObservationCoordinatorOptions {
  readonly configuration: OperationalRuntimeConfiguration;
  readonly now: () => string;
  readonly runner?: ReadonlyToolRunner;
}

export class RuntimeObservationCoordinator {
  readonly #configuration: OperationalRuntimeConfiguration;
  readonly #manifestSource: LocalMissionManifestSource;
  readonly #gitSource: LocalGitObservationSource;
  readonly #artifactSource: LocalArtifactSource;
  readonly #tmuxSource: LocalTmuxObservationSource;
  readonly #now: () => string;
  readonly #actorsByWorkUnit = new Map<string, RuntimeActorRegistration>();
  #manifest: MissionManifest | undefined;
  #snapshot: RuntimeObservationSnapshot | undefined;
  #refreshSequence = 0;
  #refreshing: Promise<RuntimeObservationSnapshot> | undefined;

  private constructor(
    options: RuntimeObservationCoordinatorOptions,
    sources: {
      readonly manifest: LocalMissionManifestSource;
      readonly git: LocalGitObservationSource;
      readonly artifact: LocalArtifactSource;
      readonly tmux: LocalTmuxObservationSource;
    },
  ) {
    this.#configuration = options.configuration;
    this.#manifestSource = sources.manifest;
    this.#gitSource = sources.git;
    this.#artifactSource = sources.artifact;
    this.#tmuxSource = sources.tmux;
    this.#now = options.now;
  }

  public static async create(
    options: RuntimeObservationCoordinatorOptions,
  ): Promise<RuntimeObservationCoordinator> {
    const registry = await createLocalProjectRegistry(options.configuration.projects);
    const runner = options.runner ?? new NodeReadonlyToolRunner(undefined, options.now);
    const git = new LocalGitObservationSource(
      registry,
      runner,
      options.configuration.gitSources,
    );
    const coordinator = new RuntimeObservationCoordinator(options, {
      git,
      manifest: new LocalMissionManifestSource(
        registry,
        git,
        options.configuration.manifestSources,
      ),
      artifact: new LocalArtifactSource(
        registry,
        git,
        options.configuration.artifactSources,
      ),
      tmux: new LocalTmuxObservationSource(
        registry,
        runner,
        options.configuration.tmuxSources,
      ),
    });
    coordinator.validateStaticRegistrations();
    return coordinator;
  }

  public async start(): Promise<MissionManifest> {
    const observation = await this.readManifest();
    if (observation.status !== 'VERIFIED' || observation.manifest === undefined) {
      throw new DomainError(
        'AUTHORITY_ARTIFACT_INVALID',
        `mission manifest authority is not verified: ${observation.status}`,
      );
    }
    this.#manifest = observation.manifest;
    this.validateMissionIsolation(observation.manifest);
    await this.refresh(observation);
    return observation.manifest;
  }

  public snapshot(): RuntimeObservationSnapshot {
    if (this.#snapshot === undefined) {
      throw new DomainError('EVIDENCE_MISSING_OR_STALE', 'observation coordinator has not started');
    }
    return this.#snapshot;
  }

  public refresh(
    knownManifest?: MissionManifestObservation,
  ): Promise<RuntimeObservationSnapshot> {
    if (this.#refreshing !== undefined) return this.#refreshing;
    if (
      knownManifest === undefined &&
      this.#snapshot !== undefined &&
      Date.parse(this.validNow()) - Date.parse(this.#snapshot.refreshedAt) <
        this.#configuration.refreshIntervalMs
    ) {
      return Promise.resolve(this.#snapshot);
    }
    const refreshing = this.refreshOnce(knownManifest).finally(() => {
      if (this.#refreshing === refreshing) this.#refreshing = undefined;
    });
    this.#refreshing = refreshing;
    return refreshing;
  }

  public workUnitObservations(
    mission: MissionProjection,
    events: readonly EventEnvelope[],
  ): readonly DashboardObservationInput[] {
    const snapshot = this.snapshot();
    const acceptedEvents = new Set(
      events.filter((event) => event.missionId === mission.missionId).map((event) => event.eventId),
    );
    return Object.values(mission.workUnits).map((workUnit) => {
      const actor = this.#actorsByWorkUnit.get(workUnit.id);
      if (snapshot.manifest.status !== 'VERIFIED') {
        return {
          workUnitId: workUnit.id,
          presentation: evidencePresentation(snapshot.manifest.status),
          evidenceRef: snapshot.manifest.evidence.evidenceId,
          reasonCode: `MANIFEST_${snapshot.manifest.status}`,
        };
      }
      if (!requiresLiveActivity(workUnit.state)) {
        return {
          workUnitId: workUnit.id,
          presentation: 'CURRENT',
          observedAt: snapshot.refreshedAt,
          evidenceRef: snapshot.manifest.evidence.evidenceId,
          reasonCode: 'VERIFIED_CANONICAL_MANIFEST_STATE',
        };
      }
      const activityEventIds = workUnit.activity?.sourceEventIds ?? [];
      const activityAccepted =
        activityEventIds.length > 0 && activityEventIds.every((eventId) => acceptedEvents.has(eventId));
      if (!activityAccepted || workUnit.activity?.effectiveFrom === undefined) {
        return {
          workUnitId: workUnit.id,
          presentation: 'UNKNOWN',
          evidenceRef: snapshot.manifest.evidence.evidenceId,
          reasonCode: 'STRUCTURED_ACTIVITY_EVENT_MISSING',
        };
      }
      const actorObservation = actor === undefined ? undefined : snapshot.actors[actor.roleInstanceId];
      if (actorObservation === undefined) {
        return {
          workUnitId: workUnit.id,
          presentation: 'UNKNOWN',
          evidenceRef: snapshot.manifest.evidence.evidenceId,
          reasonCode: 'ACTOR_OBSERVATION_NOT_REGISTERED',
        };
      }
      return {
        workUnitId: workUnit.id,
        presentation: actorObservation.presentation,
        ...(actorObservation.observedAt === undefined ? {} : { observedAt: actorObservation.observedAt }),
        evidenceRef: actorObservation.evidenceRefs[0] ?? snapshot.manifest.evidence.evidenceId,
        reasonCode: actorObservation.presentation === 'CURRENT'
          ? 'VERIFIED_STRUCTURED_ACTIVITY_AND_ACTOR_SOURCE'
          : actorObservation.reasonCode,
      };
    });
  }

  public dashboardEvidence(): readonly DashboardEvidenceInput[] {
    const snapshot = this.snapshot();
    const manifest = snapshot.manifest.evidence;
    if (
      manifest.relativePath === undefined ||
      manifest.sha256 === undefined ||
      manifest.commit === undefined
    ) {
      throw new DomainError('EVIDENCE_MISSING_OR_STALE', 'manifest evidence reference is incomplete');
    }
    const evidence: DashboardEvidenceInput[] = [{
      evidenceId: manifest.evidenceId,
      label: 'Canonical mission manifest authority',
      relativePath: manifest.relativePath,
      sha256: manifest.sha256,
      commit: manifest.commit,
      verificationState: manifest.status,
    }];
    for (const registration of this.#configuration.artifactSources) {
      const observation = snapshot.artifacts[registration.artifactId];
      if (observation === undefined) continue;
      const reference = observation.evidence;
      if (
        reference.relativePath === undefined ||
        reference.sha256 === undefined ||
        reference.commit === undefined
      ) continue;
      evidence.push({
        evidenceId: reference.evidenceId,
        label: `Registered immutable artifact ${reference.evidenceId}`,
        relativePath: reference.relativePath,
        sha256: reference.sha256,
        commit: reference.commit,
        verificationState: reference.status,
      });
    }
    return evidence;
  }

  public sceneRoles(
    mission: MissionProjection,
    events: readonly EventEnvelope[],
    alerts: Readonly<Record<string, DurableAlertProjection>>,
  ): readonly RoleSceneProjection[] {
    const snapshot = this.snapshot();
    const workUnitObservations = new Map(
      this.workUnitObservations(mission, events).map((observation) => [observation.workUnitId, observation]),
    );
    const acceptedEventIds = events
      .filter((event) => event.missionId === mission.missionId)
      .map((event) => event.eventId)
      .sort();
    return this.#configuration.actors.map((registration) => {
      const workUnit = selectActorWorkUnit(registration, mission);
      const actor = snapshot.actors[registration.roleInstanceId];
      const observation = workUnit === undefined ? undefined : workUnitObservations.get(workUnit.id);
      const activity =
        workUnit?.activity?.effectiveFrom === undefined || workUnit.activity.sourceEventIds.length === 0
          ? undefined
          : {
              activity: workUnit.activity.activity,
              reasonCode: workUnit.activity.reasonCode,
              sourceEventIds: workUnit.activity.sourceEventIds,
              effectiveFrom: workUnit.activity.effectiveFrom,
              ...(workUnit.activity.optionalExpiresAt === undefined
                ? {}
                : { optionalExpiresAt: workUnit.activity.optionalExpiresAt }),
            };
      return {
        projectionRevision: mission.sequence,
        missionSequence: mission.sequence,
        roleInstanceId: registration.roleInstanceId,
        stationId: registration.stationId,
        actorRole: registration.actorRole,
        missionId: mission.missionId,
        ...(workUnit === undefined
          ? {}
          : {
              workUnitId: workUnit.id,
              workUnitState: workUnit.state,
              ...(workUnit.lastAcceptedEventId === undefined
                ? {}
                : { stateSourceEventId: workUnit.lastAcceptedEventId }),
              ...(activity === undefined ? {} : { activity }),
            }),
        evaluatedAt: snapshot.refreshedAt,
        acceptedEventIds,
        evidenceFreshness: observation?.presentation ?? actor?.presentation ?? 'UNKNOWN',
        connectionState: actor?.connectionState ?? 'UNKNOWN',
        openAlertSeverity: workUnit === undefined ? 'NONE' : alertSeverity(workUnit.id, alerts),
      };
    });
  }

  private async refreshOnce(
    knownManifest?: MissionManifestObservation,
  ): Promise<RuntimeObservationSnapshot> {
    const expectedManifest = this.#manifest;
    if (expectedManifest === undefined) {
      throw new DomainError('EVIDENCE_MISSING_OR_STALE', 'observation coordinator has no mission authority');
    }
    const refreshedAt = this.validNow();
    let manifest = knownManifest ?? await this.readManifest();
    if (
      manifest.status === 'VERIFIED' &&
      manifest.manifest !== undefined &&
      (
        manifest.manifest.missionId !== expectedManifest.missionId ||
        manifest.manifest.manifestVersion !== expectedManifest.manifestVersion ||
        manifest.manifest.source.sha256 !== expectedManifest.source.sha256
      )
    ) {
      manifest = { ...manifest, status: 'INVALID', evidence: { ...manifest.evidence, status: 'INVALID' } };
    }

    const gitIds = unique(
      this.#configuration.actors.flatMap((actor) => actor.gitSourceId === undefined ? [] : [actor.gitSourceId]),
    );
    const tmuxIds = unique(
      this.#configuration.actors.flatMap((actor) => actor.tmuxSourceId === undefined ? [] : [actor.tmuxSourceId]),
    );
    const artifactIds = unique(this.#configuration.actors.flatMap((actor) => actor.artifactIds));
    const [gitEntries, tmuxEntries, artifactEntries] = await Promise.all([
      Promise.all(gitIds.map(async (sourceId) => [sourceId, await capture(() => this.#gitSource.observe(sourceId))] as const)),
      Promise.all(tmuxIds.map(async (sourceId) => [sourceId, await capture(() => this.#tmuxSource.observe(sourceId))] as const)),
      Promise.all(artifactIds.map(async (artifactId) => [artifactId, await capture(() => this.#artifactSource.read(artifactId))] as const)),
    ]);
    const git = new Map(gitEntries);
    const tmux = new Map(tmuxEntries);
    const artifacts = Object.fromEntries(
      artifactEntries.flatMap(([artifactId, result]) =>
        'value' in result ? [[artifactId, result.value] as const] : []),
    );
    const actors = Object.fromEntries(
      this.#configuration.actors.map((actor) => [
        actor.roleInstanceId,
        this.evaluateActor(actor, manifest, git, tmux, artifactEntries, refreshedAt),
      ]),
    );
    const snapshot: RuntimeObservationSnapshot = {
      schemaVersion: 'agent-office.runtime-observation-snapshot.v1',
      missionId: expectedManifest.missionId,
      manifestVersion: expectedManifest.manifestVersion,
      refreshedAt,
      refreshSequence: ++this.#refreshSequence,
      manifest,
      actors,
      artifacts,
    };
    this.#snapshot = snapshot;
    return snapshot;
  }

  private evaluateActor(
    actor: RuntimeActorRegistration,
    manifest: MissionManifestObservation,
    git: ReadonlyMap<string, SourceResult<GitRepositoryObservation>>,
    tmux: ReadonlyMap<string, SourceResult<TmuxPaneObservation>>,
    artifactEntries: readonly (readonly [string, SourceResult<ArtifactObservation>])[],
    evaluatedAt: string,
  ): RuntimeActorObservation {
    const candidates: PresentedSource[] = [];
    const evidenceRefs: string[] = [manifest.evidence.evidenceId];
    if (manifest.status !== 'VERIFIED') {
      candidates.push({
        presentation: evidencePresentation(manifest.status),
        reasonCode: `MANIFEST_${manifest.status}`,
      });
    }

    let connectionState: SceneConnectionState = 'UNKNOWN';
    let observedAt: string | undefined;
    if (actor.tmuxSourceId === undefined) {
      candidates.push({ presentation: 'UNKNOWN', reasonCode: 'TMUX_SOURCE_NOT_REGISTERED' });
    } else {
      evidenceRefs.push(actor.tmuxSourceId);
      const result = tmux.get(actor.tmuxSourceId);
      if (result === undefined || !('value' in result)) {
        const errorCode = result?.errorCode ?? 'TOOL_FAILED';
        const presentation = sourceErrorPresentation(errorCode);
        candidates.push({ presentation, reasonCode: `TMUX_${errorCode}` });
        connectionState = presentation === 'CONFLICT' ? 'CONFLICT' : 'UNKNOWN';
      } else {
        const observation = result.value;
        observedAt = observation.observedAt;
        if (
          observation.projectId !== actor.projectId ||
          observation.hostId !== actor.hostId ||
          observation.sourceId !== actor.tmuxSourceId
        ) {
          candidates.push({ presentation: 'CONFLICT', reasonCode: 'TMUX_IDENTITY_MISMATCH' });
          connectionState = 'CONFLICT';
        } else if (observation.synchronizePanes) {
          candidates.push({ presentation: 'CONFLICT', reasonCode: 'TMUX_SYNCHRONIZED_PANES_CONFLICT' });
          connectionState = 'CONFLICT';
        } else if (observation.paneDead) {
          candidates.push({ presentation: 'OFFLINE', reasonCode: 'TMUX_PANE_DEAD' });
          connectionState = 'OFFLINE';
        } else {
          const freshness = evaluateFreshness(
            {
              sourceTime: observation.lastActivityAt,
              receivedTime: observation.observedAt,
              clockQuality: 'VERIFIED_LOCAL',
            },
            evaluatedAt,
            this.#configuration.freshnessPolicies.tmux,
          );
          candidates.push({ presentation: freshness.presentation, reasonCode: freshness.reasonCode });
          connectionState = freshness.presentation === 'CURRENT'
            ? 'CONNECTED'
            : freshness.presentation === 'OFFLINE'
              ? 'OFFLINE'
              : freshness.presentation === 'CONFLICT'
                ? 'CONFLICT'
                : 'UNKNOWN';
        }
      }
    }

    if (actor.gitSourceId === undefined) {
      candidates.push({ presentation: 'UNKNOWN', reasonCode: 'GIT_SOURCE_NOT_REGISTERED' });
    } else {
      evidenceRefs.push(actor.gitSourceId);
      const result = git.get(actor.gitSourceId);
      if (result === undefined || !('value' in result)) {
        const errorCode = result?.errorCode ?? 'TOOL_FAILED';
        candidates.push({
          presentation: sourceErrorPresentation(errorCode),
          reasonCode: `GIT_${errorCode}`,
        });
      } else {
        const observation = result.value;
        observedAt ??= observation.observedAt;
        if (observation.projectId !== actor.projectId || observation.sourceId !== actor.gitSourceId) {
          candidates.push({ presentation: 'CONFLICT', reasonCode: 'GIT_IDENTITY_MISMATCH' });
        } else if (observation.dirty) {
          candidates.push({ presentation: 'CONFLICT', reasonCode: 'GIT_SOURCE_DIRTY' });
        } else if (
          observation.upstreamRef === undefined ||
          observation.upstreamCommit === undefined ||
          observation.headCommit !== observation.upstreamCommit
        ) {
          candidates.push({ presentation: 'UNKNOWN', reasonCode: 'GIT_UPSTREAM_UNVERIFIED' });
        } else {
          const freshness = evaluateFreshness(
            {
              sourceTime: observation.observedAt,
              receivedTime: observation.observedAt,
              clockQuality: 'VERIFIED_LOCAL',
            },
            evaluatedAt,
            this.#configuration.freshnessPolicies.git,
          );
          candidates.push({ presentation: freshness.presentation, reasonCode: freshness.reasonCode });
        }
      }
    }

    const artifactMap = new Map(artifactEntries);
    for (const artifactId of actor.artifactIds) {
      evidenceRefs.push(artifactId);
      const result = artifactMap.get(artifactId);
      if (result === undefined || !('value' in result)) {
        const errorCode = result?.errorCode ?? 'TOOL_FAILED';
        candidates.push({
          presentation: sourceErrorPresentation(errorCode),
          reasonCode: `ARTIFACT_${errorCode}`,
        });
      } else if (result.value.status !== 'VERIFIED') {
        candidates.push({
          presentation: evidencePresentation(result.value.status),
          reasonCode: `ARTIFACT_${result.value.status}`,
        });
      }
    }
    const winner = worstPresentation(candidates);
    return {
      roleInstanceId: actor.roleInstanceId,
      stationId: actor.stationId,
      actorRole: actor.actorRole,
      projectId: actor.projectId,
      hostId: actor.hostId,
      presentation: winner.presentation,
      connectionState,
      reasonCode: winner.reasonCode,
      ...(observedAt === undefined ? {} : { observedAt }),
      evidenceRefs: unique(evidenceRefs).sort(),
    };
  }

  private async readManifest(): Promise<MissionManifestObservation> {
    try {
      return await this.#manifestSource.read(this.#configuration.missionSourceId);
    } catch (error) {
      const registration = this.#configuration.manifestSources.find(
        (source) => source.sourceId === this.#configuration.missionSourceId,
      );
      if (registration === undefined) throw error;
      return {
        status: 'UNVERIFIED',
        evidence: {
          evidenceId: registration.sourceId,
          projectId: registration.projectId,
          sourceId: registration.sourceId,
          relativePath: registration.relativePath,
          sha256: registration.sourceMetadata.sha256,
          commit: registration.sourceMetadata.commit,
          status: 'UNVERIFIED',
          errorCode: error instanceof ObservationError ? error.code : 'TOOL_FAILED',
        },
      };
    }
  }

  private validateStaticRegistrations(): void {
    const configuration = this.#configuration;
    const manifest = configuration.manifestSources.filter(
      (source) => source.sourceId === configuration.missionSourceId,
    );
    if (manifest.length !== 1 || manifest[0]?.gitSourceId === undefined) {
      throw new DomainError(
        'INVALID_SCHEMA',
        'operational mission source must have one exact Git-verified registration',
      );
    }
    const projectHosts = new Map(configuration.projects.map((project) => [project.projectId, project.hostId]));
    const gitProjects = new Map(configuration.gitSources.map((source) => [source.sourceId, source.projectId]));
    const tmuxProjects = new Map(
      configuration.tmuxSources.map((source) => [source.sourceId, {
        projectId: source.projectId,
        hostId: source.hostId,
      }]),
    );
    const artifactProjects = new Map(
      configuration.artifactSources.map((source) => [source.artifactId, source.projectId]),
    );
    const stations = new Set<string>();
    const roleInstances = new Set<string>();
    for (const actor of configuration.actors) {
      if (stations.has(actor.stationId) || roleInstances.has(actor.roleInstanceId)) {
        throw new DomainError('INVALID_SCHEMA', 'actor station and role-instance identities must be unique');
      }
      stations.add(actor.stationId);
      roleInstances.add(actor.roleInstanceId);
      if (projectHosts.get(actor.projectId) !== actor.hostId) {
        throw new DomainError('INVALID_SCHEMA', 'actor host does not match its registered project');
      }
      if (actor.gitSourceId !== undefined && gitProjects.get(actor.gitSourceId) !== actor.projectId) {
        throw new DomainError('INVALID_SCHEMA', 'actor Git source crosses project scope');
      }
      const tmux = actor.tmuxSourceId === undefined ? undefined : tmuxProjects.get(actor.tmuxSourceId);
      if (
        actor.tmuxSourceId !== undefined &&
        (tmux?.projectId !== actor.projectId || tmux.hostId !== actor.hostId)
      ) {
        throw new DomainError('INVALID_SCHEMA', 'actor tmux source crosses project or host scope');
      }
      if (actor.artifactIds.some((artifactId) => artifactProjects.get(artifactId) !== actor.projectId)) {
        throw new DomainError('INVALID_SCHEMA', 'actor artifact source crosses project scope');
      }
    }
    if (stations.size !== 8) {
      throw new DomainError('INVALID_SCHEMA', 'all eight canonical office stations must be registered exactly once');
    }
  }

  private validateMissionIsolation(manifest: MissionManifest): void {
    const expected = new Set(manifest.workUnits.map((workUnit) => workUnit.id));
    for (const actor of this.#configuration.actors) {
      for (const workUnitId of actor.workUnitIds) {
        if (!expected.has(workUnitId) || this.#actorsByWorkUnit.has(workUnitId)) {
          throw new DomainError('MANIFEST_VERSION_CONFLICT', 'WorkUnit observation registration is missing or duplicated');
        }
        const workUnit = manifest.workUnits.find((candidate) => candidate.id === workUnitId);
        if (
          workUnit === undefined ||
          !actor.acceptedManifestActorRoles.includes(workUnit.actor)
        ) {
          throw new DomainError('MANIFEST_VERSION_CONFLICT', 'WorkUnit actor authority does not match its station registration');
        }
        this.#actorsByWorkUnit.set(workUnitId, actor);
      }
    }
    if (
      this.#actorsByWorkUnit.size !== expected.size ||
      [...expected].some((workUnitId) => !this.#actorsByWorkUnit.has(workUnitId))
    ) {
      throw new DomainError('MANIFEST_VERSION_CONFLICT', 'every manifest WorkUnit requires one isolated actor registration');
    }
  }

  private validNow(): string {
    const value = this.#now();
    if (!Number.isFinite(Date.parse(value))) {
      throw new DomainError('INVALID_SCHEMA', 'observation runtime clock is invalid');
    }
    return value;
  }
}

interface PresentedSource {
  readonly presentation: ObservationPresentation;
  readonly reasonCode: string;
}

function worstPresentation(candidates: readonly PresentedSource[]): PresentedSource {
  const ranking: Readonly<Record<ObservationPresentation, number>> = {
    CURRENT: 0,
    UNKNOWN: 1,
    STALE: 2,
    OFFLINE: 3,
    ERROR: 4,
    CONFLICT: 5,
  };
  return candidates.reduce<PresentedSource>(
    (worst, candidate) => ranking[candidate.presentation] > ranking[worst.presentation] ? candidate : worst,
    { presentation: 'CURRENT', reasonCode: 'STRUCTURED_SOURCES_CURRENT' },
  );
}

function evidencePresentation(status: MissionManifestObservation['status']): ObservationPresentation {
  switch (status) {
    case 'VERIFIED':
      return 'CURRENT';
    case 'STALE':
      return 'STALE';
    case 'DIRTY':
      return 'CONFLICT';
    case 'INVALID':
      return 'ERROR';
    case 'MISSING':
    case 'UNVERIFIED':
      return 'UNKNOWN';
  }
}

function sourceErrorPresentation(errorCode: string): ObservationPresentation {
  if (errorCode === 'IDENTITY_MISMATCH' || errorCode === 'CONFLICT') return 'CONFLICT';
  if (errorCode === 'FILE_MISSING') return 'UNKNOWN';
  return 'ERROR';
}

async function capture<T>(operation: () => Promise<T>): Promise<SourceResult<T>> {
  try {
    return { value: await operation() };
  } catch (error) {
    return { errorCode: observationErrorCode(error) ?? 'TOOL_FAILED' };
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function requiresLiveActivity(state: MissionProjection['workUnits'][string]['state']): boolean {
  return ['DISPATCHED', 'RUNNING', 'TESTING', 'RESULT_REPORTED', 'REVIEW_PENDING'].includes(state);
}

function selectActorWorkUnit(
  actor: RuntimeActorRegistration,
  mission: MissionProjection,
) {
  const candidates = actor.workUnitIds
    .map((workUnitId) => mission.workUnits[workUnitId])
    .filter((workUnit): workUnit is NonNullable<typeof workUnit> => workUnit !== undefined);
  return candidates.find((workUnit) => !['COMPLETED', 'CANCELLED'].includes(workUnit.state)) ?? candidates.at(-1);
}

function alertSeverity(
  workUnitId: string,
  alerts: Readonly<Record<string, DurableAlertProjection>>,
): SceneAlertSeverity {
  const ranking: Readonly<Record<SceneAlertSeverity, number>> = {
    NONE: 0,
    INFO: 1,
    WARNING: 2,
    CRITICAL: 3,
  };
  let result: SceneAlertSeverity = 'NONE';
  for (const alert of Object.values(alerts)) {
    if (alert.state === 'RESOLVED' || alert.state === 'SUPPRESSED') continue;
    const references = [alert.payload.primaryEntityRef, ...alert.payload.relatedEntityRefs];
    if (!references.some((reference) => reference.entityType === 'WORK_UNIT' && reference.entityId === workUnitId)) {
      continue;
    }
    if (ranking[alert.payload.severity] > ranking[result]) result = alert.payload.severity;
  }
  return result;
}
