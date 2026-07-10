import { canonicalize } from '../../persistence/file-store/canonical-json.js';
import { CheckpointStore } from '../../persistence/file-store/checkpoint-store.js';
import { EventStore, type EventStoreOpenOptions, type TailRecoveryReceipt } from '../../persistence/file-store/event-store.js';
import { StoreError } from '../../persistence/file-store/errors.js';
import { GENESIS_EVENT_HASH } from '../../persistence/file-store/hashing.js';
import { ProjectionStore } from '../../persistence/file-store/projection-store.js';
import type { MissionManifest } from '../../domain/manifest/index.js';
import {
  replayFromCheckpoint,
  replayMission,
  type MissionProjection,
} from '../projections/mission-projector.js';

export const STARTUP_PHASES = [
  'STARTING',
  'CONFIG_VALIDATING',
  'LOCK_ACQUIRING',
  'STORE_VERIFYING',
  'REPLAYING',
  'READ_ONLY_READY',
  'MUTATION_READY',
] as const;

export type StartupPhase = (typeof STARTUP_PHASES)[number];

export interface RecoveryResult {
  readonly store: EventStore;
  readonly projection: MissionProjection;
  readonly usedCheckpoint: boolean;
  readonly phases: readonly StartupPhase[];
  readonly tailRecoveries: readonly TailRecoveryReceipt[];
}

export async function recoverMissionState(
  manifest: MissionManifest,
  options: Omit<EventStoreOpenOptions, 'missionId' | 'manifestVersion'>,
  manifestHistory: readonly MissionManifest[] = [manifest],
): Promise<RecoveryResult> {
  const phases: StartupPhase[] = ['STARTING', 'CONFIG_VALIDATING', 'LOCK_ACQUIRING'];
  const store = await EventStore.open({
    ...options,
    missionId: manifest.missionId,
    manifestVersion: manifest.manifestVersion,
  });
  try {
    phases.push('STORE_VERIFYING', 'REPLAYING');
    const events = store.readAll();
    const fullProjection = replayMission(manifest, events, manifestHistory);
    const checkpoints = await CheckpointStore.open(options.root);
    const checkpoint = await checkpoints.load(manifest.missionId);
    let usedCheckpoint = false;
    if (checkpoint !== undefined) {
      const sourceHash =
        checkpoint.sequence === 0
          ? GENESIS_EVENT_HASH
          : events[checkpoint.sequence - 1]?.eventHash;
      if (sourceHash === checkpoint.eventHash && checkpoint.sequence <= events.length) {
        const checkpointProjection = replayFromCheckpoint(
          checkpoint.projection,
          events.slice(checkpoint.sequence),
          manifestHistory,
        );
        if (canonicalize(checkpointProjection) !== canonicalize(fullProjection)) {
          throw new StoreError('MIDSTREAM_CORRUPTION', 'genesis and checkpoint replay are not equivalent');
        }
        usedCheckpoint = true;
      }
    }
    const projections = await ProjectionStore.open(options.root);
    const storedProjection = await projections.load(manifest.missionId);
    if (
      storedProjection?.sequence === fullProjection.sequence &&
      storedProjection.eventHash === fullProjection.eventHash &&
      canonicalize(storedProjection) !== canonicalize(fullProjection)
    ) {
      throw new StoreError('MIDSTREAM_CORRUPTION', 'stored and replayed projection content differ');
    }
    await projections.publish(fullProjection);
    await checkpoints.save(fullProjection);
    phases.push('READ_ONLY_READY', 'MUTATION_READY');
    return {
      store,
      projection: fullProjection,
      usedCheckpoint,
      phases,
      tailRecoveries: store.getTailRecoveryReceipts(),
    };
  } catch (error) {
    await store.close().catch(() => undefined);
    throw error;
  }
}
