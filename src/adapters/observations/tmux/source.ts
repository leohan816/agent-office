import { TextDecoder } from 'node:util';

import { assertStableId, type LocalProjectRegistry } from '../../../application/projects/registry.js';
import { ObservationError } from '../errors.js';
import type { TmuxObservationSource, TmuxPaneObservation } from '../ports.js';
import type { ReadonlyToolRunner, TmuxReadRequest, ToolReadLimits } from '../process-runner.js';

const SESSION_ID = /^\$[0-9]+$/u;
const WINDOW_ID = /^@[0-9]+$/u;
const PANE_ID = /^%[0-9]+$/u;
const decoder = new TextDecoder('utf-8', { fatal: true });

export interface TmuxSourceRegistration {
  readonly sourceId: string;
  readonly projectId: string;
  readonly hostId: string;
  readonly sessionId: string;
  readonly windowId: string;
  readonly paneId: string;
  readonly sessionNameEscaped: string;
  readonly windowNameEscaped: string;
  readonly windowIndex: number;
  readonly paneIndex: number;
  readonly workspaceRootId: string;
  readonly currentCommandEscaped?: string;
  readonly limits: ToolReadLimits;
}

interface RegisteredTmuxSource extends TmuxSourceRegistration {
  readonly workspacePath: string;
}

export class LocalTmuxObservationSource implements TmuxObservationSource {
  readonly #sources = new Map<string, RegisteredTmuxSource>();

  public constructor(
    registry: LocalProjectRegistry,
    private readonly runner: ReadonlyToolRunner,
    registrations: readonly TmuxSourceRegistration[],
  ) {
    for (const registration of registrations) {
      assertStableId(registration.sourceId, 'tmux sourceId');
      const project = registry.getProject(registration.projectId);
      const workspace = registry.getTrustedRoot(
        registration.projectId,
        registration.workspaceRootId,
        'WORKSPACE',
      );
      if (
        this.#sources.has(registration.sourceId) ||
        project.hostId !== registration.hostId ||
        !SESSION_ID.test(registration.sessionId) ||
        !WINDOW_ID.test(registration.windowId) ||
        !PANE_ID.test(registration.paneId) ||
        !Number.isSafeInteger(registration.windowIndex) ||
        !Number.isSafeInteger(registration.paneIndex) ||
        registration.windowIndex < 0 ||
        registration.paneIndex < 0 ||
        !isSafeEscapedField(registration.sessionNameEscaped) ||
        !isSafeEscapedField(registration.windowNameEscaped) ||
        (registration.currentCommandEscaped !== undefined &&
          !isSafeEscapedField(registration.currentCommandEscaped))
      ) {
        throw new ObservationError('CONFIG_INVALID', 'tmux source registration is invalid');
      }
      this.#sources.set(registration.sourceId, {
        ...registration,
        workspacePath: workspace.canonicalPath,
      });
    }
  }

  public async observe(sourceId: string): Promise<TmuxPaneObservation> {
    const source = this.#sources.get(sourceId);
    if (source === undefined) {
      throw new ObservationError('CONFIG_INVALID', `tmux source ID is not registered: ${sourceId}`);
    }
    const request: TmuxReadRequest = {
      kind: 'EXACT_PANE_METADATA',
      paneId: source.paneId,
      limits: source.limits,
    };
    const result = await this.runner.readTmux(request);
    if (result.exitCode !== 0) {
      throw new ObservationError('TOOL_FAILED', 'tmux metadata read returned a nonzero status');
    }
    const fields = decodeStructuredFields(result.stdout);
    const [
      sessionId,
      windowId,
      paneId,
      sessionNameEscaped,
      windowNameEscaped,
      windowIndexText,
      paneIndexText,
      workspacePath,
      currentCommandEscaped,
      paneDeadText,
      activityTimeText,
      synchronizePanesText,
    ] = fields;
    if (
      sessionId !== source.sessionId ||
      windowId !== source.windowId ||
      paneId !== source.paneId ||
      sessionNameEscaped !== source.sessionNameEscaped ||
      windowNameEscaped !== source.windowNameEscaped ||
      workspacePath !== source.workspacePath ||
      (source.currentCommandEscaped !== undefined &&
        currentCommandEscaped !== source.currentCommandEscaped)
    ) {
      throw new ObservationError('IDENTITY_MISMATCH', 'tmux metadata does not match registered identity');
    }
    const windowIndex = parseNonnegativeInteger(windowIndexText, 'window index');
    const paneIndex = parseNonnegativeInteger(paneIndexText, 'pane index');
    const activityTimeSeconds = parseNonnegativeInteger(activityTimeText, 'window activity time');
    if (windowIndex !== source.windowIndex || paneIndex !== source.paneIndex) {
      throw new ObservationError('IDENTITY_MISMATCH', 'tmux index does not match registered identity');
    }
    if (!['0', '1'].includes(paneDeadText) || !['0', '1'].includes(synchronizePanesText)) {
      throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'tmux boolean metadata is malformed');
    }
    return {
      projectId: source.projectId,
      sourceId: source.sourceId,
      hostId: source.hostId,
      sessionId,
      windowId,
      paneId,
      sessionNameEscaped,
      windowNameEscaped,
      windowIndex,
      paneIndex,
      workspaceRootId: source.workspaceRootId,
      currentCommandEscaped,
      paneDead: paneDeadText === '1',
      lastActivityAt: new Date(activityTimeSeconds * 1000).toISOString(),
      synchronizePanes: synchronizePanesText === '1',
      observedAt: result.completedAt,
    };
  }
}

export function decodeStructuredFields(bytes: Uint8Array): readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] {
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch (error) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'tmux output is not valid UTF-8', { cause: error });
  }
  if (text.endsWith('\n')) text = text.slice(0, -1);
  if (text.length === 0 || text.includes('\n') || text.includes('\r') || text.includes('\u0000')) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'tmux output is not one structured record');
  }
  const fields = text.split('\u001f');
  if (fields.length !== 12 || fields.some((field) => field.length === 0 || !isSafeEscapedField(field))) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'tmux structured field count is invalid');
  }
  return fields as unknown as readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}

function isSafeEscapedField(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 4096 &&
    !value.includes('\u001f') &&
    !value.includes('\u0000') &&
    !value.includes('\n') &&
    !value.includes('\r')
  );
}

function parseNonnegativeInteger(value: string, label: string): number {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', `tmux ${label} is malformed`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', `tmux ${label} exceeds the safe range`);
  }
  return number;
}
