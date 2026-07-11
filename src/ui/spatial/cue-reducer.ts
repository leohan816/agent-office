import {
  isSpatialRouteCue,
  type SpatialCueEnvelope,
  type SpatialCueKind,
  type SpatialCueProjectionResult,
  type SpatialCueUpdateOrigin,
} from './cue-projector.js';

export const SPATIAL_CUE_PENDING_LIMIT = 3 as const;
export const SPATIAL_CUE_ROUTE_LIMIT = 1 as const;
export const SPATIAL_CUE_SEEN_LIMIT = 512 as const;
export const SPATIAL_SOURCE_SEEN_LIMIT = 2048 as const;
export const SPATIAL_ACTIVITY_LOG_LIMIT = 64 as const;

export interface SpatialCueActivityLogEntry {
  readonly entryId: string;
  readonly projectionRevision: number;
  readonly roleInstanceId: string;
  readonly cueKind: SpatialCueKind | null;
  readonly outcome: 'QUEUED' | 'STATIC_EQUIVALENT' | 'OVERFLOW_TO_LOG' | 'SUPPRESSED' | 'CONFLICT_RESET';
  readonly text: string;
}

export interface SpatialCueReducerState {
  readonly appliedRevision: number;
  readonly projectionFingerprint: string | null;
  readonly selectedPodId: string | null;
  readonly pendingCues: readonly SpatialCueEnvelope[];
  readonly seenCueIds: readonly string[];
  readonly seenSourceEventIds: readonly string[];
  readonly activityLog: readonly SpatialCueActivityLogEntry[];
  readonly projectionConflict: boolean;
  readonly requiresFullSnapshot: boolean;
}

export interface SpatialCueReducerUpdate {
  readonly origin: SpatialCueUpdateOrigin;
  readonly projectionRevision: number;
  readonly projectionFingerprint: string;
  readonly selectedPodId: string | null;
  readonly fullSnapshotVerified: boolean;
  readonly orientationChanged?: boolean;
  readonly results: readonly SpatialCueProjectionResult[];
}

const PRECEDENCE: Readonly<Record<SpatialCueKind, number>> = {
  RECOVERY: 110,
  WAITING_LEO: 100,
  BLOCKED: 90,
  PATCH_RETURN: 88,
  REVIEW_HANDOFF: 80,
  REVIEW: 80,
  REVIEW_VERDICT_RETURN: 80,
  RESULT_RETURN: 70,
  WRITING_RESULT: 60,
  TESTING: 50,
  DELIVERY: 40,
  LEO_GPT_TO_ADVISOR_HANDOFF: 40,
  READING: 30,
  WORKING: 20,
  COMPLETION_ACKNOWLEDGEMENT: 12,
  IDLE_RELOCATE: 0,
};

export function createSpatialCueReducerState(): SpatialCueReducerState {
  return {
    appliedRevision: -1,
    projectionFingerprint: null,
    selectedPodId: null,
    pendingCues: [],
    seenCueIds: [],
    seenSourceEventIds: [],
    activityLog: [],
    projectionConflict: false,
    requiresFullSnapshot: false,
  };
}

export function reduceSpatialCues(
  state: SpatialCueReducerState,
  update: SpatialCueReducerUpdate,
): SpatialCueReducerState {
  if (update.projectionFingerprint.length === 0 || update.projectionRevision < 0) {
    return conflictReset(state, update, 'invalid projection identity');
  }

  const incomingSources = uniqueSorted(update.results.flatMap((result) => result.sourceEventIds));
  const incomingCueIds = uniqueSorted(update.results.flatMap((result) =>
    result.candidateCueId === null ? [] : [result.candidateCueId]));
  const snapshot = isFullSnapshot(update.origin) && update.fullSnapshotVerified;

  if (state.projectionConflict || state.requiresFullSnapshot) {
    if (!snapshot || update.projectionRevision < state.appliedRevision) {
      return markSeenOnly(state, update, incomingCueIds, incomingSources);
    }
  }

  if (update.projectionRevision < state.appliedRevision) {
    return markSeenOnly(state, update, incomingCueIds, incomingSources);
  }
  if (update.projectionRevision === state.appliedRevision) {
    if (update.projectionFingerprint === state.projectionFingerprint) return state;
    return conflictReset(state, update, 'duplicate revision with different content');
  }

  const nonEnqueueOrigin = update.origin !== 'LIVE_DELTA' || update.orientationChanged === true;
  if (nonEnqueueOrigin) {
    const seenBase = snapshot && (state.projectionConflict || state.requiresFullSnapshot)
      ? { ...state, seenCueIds: [], seenSourceEventIds: [] }
      : state;
    const bounded = addSeen(seenBase, incomingCueIds, incomingSources);
    return {
      ...state,
      appliedRevision: update.projectionRevision,
      projectionFingerprint: update.projectionFingerprint,
      selectedPodId: update.selectedPodId,
      pendingCues: [],
      seenCueIds: bounded.seenCueIds,
      seenSourceEventIds: bounded.seenSourceEventIds,
      projectionConflict: false,
      requiresFullSnapshot: bounded.overflow,
    };
  }

  let pending = [...state.pendingCues];
  const logEntries: SpatialCueActivityLogEntry[] = [];
  for (const result of update.results) {
    if (result.suppressionScope === 'POD') pending = [];
    if (result.suppressionScope === 'ACTOR') {
      pending = pending.filter((cue) => cue.roleInstanceId !== result.roleInstanceId);
    }
    if (result.cue === null) {
      logEntries.push(logEntry(result, 'SUPPRESSED'));
    }
  }

  const seenCues = new Set(state.seenCueIds);
  const seenSources = new Set(state.seenSourceEventIds);
  const eligible = update.results
    .map((result) => result.cue)
    .filter((cue): cue is SpatialCueEnvelope => cue !== null)
    .filter((cue) => !seenCues.has(cue.cueId) && cue.sourceEventIds.every((id) => !seenSources.has(id)));
  const combined = uniqueCues([...pending, ...eligible]).sort(compareCues);
  const selected: SpatialCueEnvelope[] = [];
  const selectedActors = new Set<string>();
  const selectedWorkUnits = new Set<string>();
  let routeCount = 0;

  for (const cue of combined) {
    const actorConflict = selectedActors.has(cue.roleInstanceId);
    const workUnitConflict = cue.workUnitId !== undefined && selectedWorkUnits.has(cue.workUnitId);
    const routeConflict = isSpatialRouteCue(cue.cueKind) && routeCount >= SPATIAL_CUE_ROUTE_LIMIT;
    if (
      selected.length >= SPATIAL_CUE_PENDING_LIMIT
      || actorConflict
      || workUnitConflict
      || routeConflict
    ) {
      if (eligible.some((candidate) => candidate.cueId === cue.cueId)) {
        logEntries.push(cueLogEntry(cue, 'OVERFLOW_TO_LOG'));
      }
      continue;
    }
    selected.push(cue);
    selectedActors.add(cue.roleInstanceId);
    if (cue.workUnitId !== undefined) selectedWorkUnits.add(cue.workUnitId);
    if (isSpatialRouteCue(cue.cueKind)) routeCount += 1;
    if (eligible.some((candidate) => candidate.cueId === cue.cueId)) {
      logEntries.push(cueLogEntry(cue, 'QUEUED'));
    }
  }

  const bounded = addSeen(state, incomingCueIds, incomingSources);
  return {
    appliedRevision: update.projectionRevision,
    projectionFingerprint: update.projectionFingerprint,
    selectedPodId: update.selectedPodId,
    pendingCues: bounded.overflow ? [] : selected,
    seenCueIds: bounded.seenCueIds,
    seenSourceEventIds: bounded.seenSourceEventIds,
    activityLog: appendLog(state.activityLog, logEntries),
    projectionConflict: false,
    requiresFullSnapshot: bounded.overflow,
  };
}

export function completeSpatialCue(
  state: SpatialCueReducerState,
  cueId: string,
): SpatialCueReducerState {
  const pendingCues = state.pendingCues.filter((cue) => cue.cueId !== cueId);
  return pendingCues.length === state.pendingCues.length ? state : { ...state, pendingCues };
}

export function cancelSpatialCue(
  state: SpatialCueReducerState,
  cueId: string,
): SpatialCueReducerState {
  return completeSpatialCue(state, cueId);
}

export function clearSpatialCues(state: SpatialCueReducerState): SpatialCueReducerState {
  return state.pendingCues.length === 0 ? state : { ...state, pendingCues: [] };
}

function conflictReset(
  state: SpatialCueReducerState,
  update: SpatialCueReducerUpdate,
  detail: string,
): SpatialCueReducerState {
  const entry: SpatialCueActivityLogEntry = {
    entryId: `conflict:${update.projectionRevision}:${update.projectionFingerprint}`,
    projectionRevision: update.projectionRevision,
    roleInstanceId: 'projection',
    cueKind: null,
    outcome: 'CONFLICT_RESET',
    text: `PROJECTION_CONFLICT: ${detail}; full verified snapshot required`,
  };
  return {
    ...state,
    pendingCues: [],
    activityLog: appendLog(state.activityLog, [entry]),
    projectionConflict: true,
    requiresFullSnapshot: true,
  };
}

function markSeenOnly(
  state: SpatialCueReducerState,
  update: SpatialCueReducerUpdate,
  cueIds: readonly string[],
  sourceIds: readonly string[],
): SpatialCueReducerState {
  const bounded = addSeen(state, cueIds, sourceIds);
  return {
    ...state,
    pendingCues: [],
    selectedPodId: update.selectedPodId,
    seenCueIds: bounded.seenCueIds,
    seenSourceEventIds: bounded.seenSourceEventIds,
    requiresFullSnapshot: true,
  };
}

function addSeen(
  state: SpatialCueReducerState,
  cueIds: readonly string[],
  sourceIds: readonly string[],
): { readonly seenCueIds: readonly string[]; readonly seenSourceEventIds: readonly string[]; readonly overflow: boolean } {
  const allCues = uniqueStable([...state.seenCueIds, ...cueIds]);
  const allSources = uniqueStable([...state.seenSourceEventIds, ...sourceIds]);
  const overflow = allCues.length > SPATIAL_CUE_SEEN_LIMIT || allSources.length > SPATIAL_SOURCE_SEEN_LIMIT;
  return {
    seenCueIds: allCues.slice(-SPATIAL_CUE_SEEN_LIMIT),
    seenSourceEventIds: allSources.slice(-SPATIAL_SOURCE_SEEN_LIMIT),
    overflow,
  };
}

function isFullSnapshot(origin: SpatialCueUpdateOrigin): boolean {
  return origin === 'INITIAL_SNAPSHOT'
    || origin === 'RELOAD_SNAPSHOT'
    || origin === 'CURSOR_RESET_SNAPSHOT';
}

function compareCues(left: SpatialCueEnvelope, right: SpatialCueEnvelope): number {
  const precedence = PRECEDENCE[right.cueKind] - PRECEDENCE[left.cueKind];
  if (precedence !== 0) return precedence;
  const sequence = right.missionSequence - left.missionSequence;
  if (sequence !== 0) return sequence;
  const leftEvent = left.sourceEventIds.at(-1) ?? '';
  const rightEvent = right.sourceEventIds.at(-1) ?? '';
  return rightEvent < leftEvent ? -1 : rightEvent > leftEvent ? 1 : 0;
}

function uniqueCues(cues: readonly SpatialCueEnvelope[]): SpatialCueEnvelope[] {
  const byId = new Map<string, SpatialCueEnvelope>();
  for (const cue of cues) if (!byId.has(cue.cueId)) byId.set(cue.cueId, cue);
  return [...byId.values()];
}

function logEntry(
  result: SpatialCueProjectionResult,
  outcome: SpatialCueActivityLogEntry['outcome'],
): SpatialCueActivityLogEntry {
  return {
    entryId: `${result.projectionRevision}:${result.roleInstanceId}:${result.diagnosticCode}:${result.sourceEventIds.join('.')}`,
    projectionRevision: result.projectionRevision,
    roleInstanceId: result.roleInstanceId,
    cueKind: result.cue?.cueKind ?? null,
    outcome,
    text: result.activityLogText,
  };
}

function cueLogEntry(
  cue: SpatialCueEnvelope,
  outcome: 'QUEUED' | 'OVERFLOW_TO_LOG',
): SpatialCueActivityLogEntry {
  return {
    entryId: `${cue.cueId}:${outcome}`,
    projectionRevision: cue.projectionRevision,
    roleInstanceId: cue.roleInstanceId,
    cueKind: cue.cueKind,
    outcome,
    text: `${cue.cueKind}: ${cue.sourceZoneId} -> ${cue.targetZoneId ?? cue.sourceZoneId}; ${cue.staticEquivalentCode}`,
  };
}

function appendLog(
  current: readonly SpatialCueActivityLogEntry[],
  entries: readonly SpatialCueActivityLogEntry[],
): readonly SpatialCueActivityLogEntry[] {
  const byId = new Map<string, SpatialCueActivityLogEntry>();
  for (const entry of [...current, ...entries]) byId.set(entry.entryId, entry);
  return [...byId.values()].slice(-SPATIAL_ACTIVITY_LOG_LIMIT);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueStable(values: readonly string[]): string[] {
  return [...new Set(values)];
}
