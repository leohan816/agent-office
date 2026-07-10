import { TextDecoder } from 'node:util';

import { assertStableId, type LocalProjectRegistry } from '../../../application/projects/registry.js';
import { ObservationError } from '../errors.js';
import type {
  GitCommitDiffEntry,
  GitObservationSource,
  GitRefObservation,
  GitRepositoryObservation,
} from '../ports.js';
import type {
  GitReadRequest,
  ReadonlyToolRunner,
  ToolReadLimits,
  ToolReadResult,
} from '../process-runner.js';

const COMMIT = /^[0-9a-f]{40}$/u;
const decoder = new TextDecoder('utf-8', { fatal: true });

export interface ConfiguredCommitPair {
  readonly commitPairId: string;
  readonly baseCommit: string;
  readonly headCommit: string;
}

export interface GitSourceRegistration {
  readonly sourceId: string;
  readonly projectId: string;
  readonly rootId: string;
  readonly limits: ToolReadLimits;
  readonly refNamespaces: readonly {
    readonly namespaceId: string;
    readonly exactPrefix: string;
  }[];
  readonly commitPairs: readonly ConfiguredCommitPair[];
}

interface RegisteredGitSource extends GitSourceRegistration {
  readonly cwd: string;
  readonly refNamespaceMap: ReadonlyMap<string, string>;
  readonly commitPairMap: ReadonlyMap<string, ConfiguredCommitPair>;
}

export class LocalGitObservationSource implements GitObservationSource {
  readonly #sources = new Map<string, RegisteredGitSource>();

  public constructor(
    registry: LocalProjectRegistry,
    private readonly runner: ReadonlyToolRunner,
    registrations: readonly GitSourceRegistration[],
  ) {
    for (const registration of registrations) {
      assertStableId(registration.sourceId, 'Git sourceId');
      if (this.#sources.has(registration.sourceId)) {
        throw new ObservationError('CONFIG_INVALID', `duplicate Git source ID: ${registration.sourceId}`);
      }
      const root = registry.getTrustedRoot(registration.projectId, registration.rootId, 'GIT');
      const refNamespaceMap = new Map<string, string>();
      for (const namespace of registration.refNamespaces) {
        assertStableId(namespace.namespaceId, 'Git namespaceId');
        if (refNamespaceMap.has(namespace.namespaceId)) {
          throw new ObservationError('CONFIG_INVALID', 'duplicate Git namespace ID');
        }
        refNamespaceMap.set(namespace.namespaceId, namespace.exactPrefix);
      }
      const commitPairMap = new Map<string, ConfiguredCommitPair>();
      for (const pair of registration.commitPairs) {
        assertStableId(pair.commitPairId, 'Git commitPairId');
        if (!COMMIT.test(pair.baseCommit) || !COMMIT.test(pair.headCommit)) {
          throw new ObservationError('CONFIG_INVALID', 'configured Git pair requires exact commit IDs');
        }
        if (commitPairMap.has(pair.commitPairId)) {
          throw new ObservationError('CONFIG_INVALID', 'duplicate Git commit pair ID');
        }
        commitPairMap.set(pair.commitPairId, pair);
      }
      this.#sources.set(registration.sourceId, {
        ...registration,
        cwd: root.canonicalPath,
        refNamespaceMap,
        commitPairMap,
      });
    }
  }

  public async observe(sourceId: string): Promise<GitRepositoryObservation> {
    const source = this.requireSource(sourceId);
    const requests = {
      topLevel: this.request(source, 'TOP_LEVEL'),
      head: this.request(source, 'HEAD'),
      upstreamName: this.request(source, 'UPSTREAM_NAME'),
      upstreamCommit: this.request(source, 'UPSTREAM_COMMIT'),
      status: this.request(source, 'STATUS'),
    } as const;
    const [topLevel, head, upstreamName, upstreamCommit, status] = await Promise.all([
      this.runner.readGit(requests.topLevel),
      this.runner.readGit(requests.head),
      this.runner.readGit(requests.upstreamName),
      this.runner.readGit(requests.upstreamCommit),
      this.runner.readGit(requests.status),
    ]);
    const observedTopLevel = decodeLine(expectSuccess(topLevel, 'Git top-level'));
    if (observedTopLevel !== source.cwd) {
      throw new ObservationError('IDENTITY_MISMATCH', 'Git top-level does not match its registered root');
    }
    const headCommit = decodeCommit(expectSuccess(head, 'Git HEAD'));
    const changedPaths = parsePorcelainV2(expectSuccess(status, 'Git status'));
    const upstream = parseUpstream(upstreamName, upstreamCommit);
    return {
      projectId: source.projectId,
      sourceId: source.sourceId,
      rootId: source.rootId,
      topLevelRootId: source.rootId,
      headCommit,
      ...upstream,
      dirty: changedPaths.length > 0,
      changedPaths,
      observedAt: latestCompletion([topLevel, head, upstreamName, upstreamCommit, status]),
    };
  }

  public async listAllowlistedRefs(
    sourceId: string,
    namespaceId: string,
  ): Promise<readonly GitRefObservation[]> {
    const source = this.requireSource(sourceId);
    const refPrefix = source.refNamespaceMap.get(namespaceId);
    if (refPrefix === undefined) {
      throw new ObservationError('CONFIG_INVALID', 'Git namespace ID is not allowlisted');
    }
    const result = await this.runner.readGit({
      kind: 'ALLOWLISTED_REFS',
      cwd: source.cwd,
      refPrefix,
      limits: source.limits,
    });
    const text = decode(expectSuccess(result, 'Git refs'));
    if (text.includes('\u0000')) {
      throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git ref output contains a NUL byte');
    }
    return text
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const fields = line.split('\t');
        const refName = fields[0];
        const commit = fields[1];
        if (
          fields.length !== 2 ||
          refName === undefined ||
          commit === undefined ||
          !refName.startsWith(refPrefix) ||
          !COMMIT.test(commit)
        ) {
          throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git ref output is malformed');
        }
        return { refName, commit };
      });
  }

  public async isConfiguredAncestor(sourceId: string, commitPairId: string): Promise<boolean> {
    const { source, pair } = this.requirePair(sourceId, commitPairId);
    const result = await this.runner.readGit({
      kind: 'ANCESTRY',
      cwd: source.cwd,
      baseCommit: pair.baseCommit,
      headCommit: pair.headCommit,
      limits: source.limits,
    });
    if (result.exitCode === 0) return true;
    if (result.exitCode === 1) return false;
    throw new ObservationError('TOOL_FAILED', 'Git ancestry read failed');
  }

  public async diffConfiguredCommits(
    sourceId: string,
    commitPairId: string,
  ): Promise<readonly GitCommitDiffEntry[]> {
    const { source, pair } = this.requirePair(sourceId, commitPairId);
    const result = await this.runner.readGit({
      kind: 'COMMIT_DIFF',
      cwd: source.cwd,
      baseCommit: pair.baseCommit,
      headCommit: pair.headCommit,
      limits: source.limits,
    });
    return parseDiffTree(expectSuccess(result, 'Git commit diff'));
  }

  private requireSource(sourceId: string): RegisteredGitSource {
    const source = this.#sources.get(sourceId);
    if (source === undefined) {
      throw new ObservationError('CONFIG_INVALID', `Git source ID is not registered: ${sourceId}`);
    }
    return source;
  }

  private requirePair(
    sourceId: string,
    commitPairId: string,
  ): { readonly source: RegisteredGitSource; readonly pair: ConfiguredCommitPair } {
    const source = this.requireSource(sourceId);
    const pair = source.commitPairMap.get(commitPairId);
    if (pair === undefined) {
      throw new ObservationError('CONFIG_INVALID', 'Git commit-pair ID is not allowlisted');
    }
    return { source, pair };
  }

  private request<K extends 'TOP_LEVEL' | 'HEAD' | 'UPSTREAM_NAME' | 'UPSTREAM_COMMIT' | 'STATUS'>(
    source: RegisteredGitSource,
    kind: K,
  ): Extract<GitReadRequest, { readonly kind: K }> {
    return { kind, cwd: source.cwd, limits: source.limits } as Extract<
      GitReadRequest,
      { readonly kind: K }
    >;
  }
}

function expectSuccess(result: ToolReadResult, label: string): Uint8Array {
  if (result.exitCode !== 0) {
    throw new ObservationError('TOOL_FAILED', `${label} returned a nonzero status`);
  }
  return result.stdout;
}

function decode(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch (error) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'tool output is not valid UTF-8', { cause: error });
  }
}

function decodeLine(bytes: Uint8Array): string {
  const value = decode(bytes).replace(/\n$/u, '');
  if (value.length === 0 || value.includes('\n') || value.includes('\r') || value.includes('\u0000')) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'tool output is not one structured line');
  }
  return value;
}

function decodeCommit(bytes: Uint8Array): string {
  const commit = decodeLine(bytes);
  if (!COMMIT.test(commit)) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git returned an invalid commit ID');
  }
  return commit;
}

function parseUpstream(
  nameResult: ToolReadResult,
  commitResult: ToolReadResult,
): Pick<GitRepositoryObservation, 'upstreamRef' | 'upstreamCommit'> {
  if (nameResult.exitCode !== 0 && commitResult.exitCode !== 0) return {};
  if (nameResult.exitCode !== 0 || commitResult.exitCode !== 0) {
    throw new ObservationError('TOOL_FAILED', 'Git upstream reads disagree');
  }
  return {
    upstreamRef: decodeLine(nameResult.stdout),
    upstreamCommit: decodeCommit(commitResult.stdout),
  };
}

export function parsePorcelainV2(bytes: Uint8Array): readonly string[] {
  const records = decode(bytes).split('\u0000');
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || record.length === 0) continue;
    if (record.startsWith('? ') || record.startsWith('! ')) {
      paths.push(record.slice(2));
      continue;
    }
    const kind = record[0];
    if (kind === '1') {
      paths.push(fieldAfterSpaces(record, 8));
      continue;
    }
    if (kind === '2') {
      paths.push(fieldAfterSpaces(record, 9));
      const priorPath = records[index + 1];
      if (priorPath === undefined || priorPath.length === 0) {
        throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git rename record is incomplete');
      }
      paths.push(priorPath);
      index += 1;
      continue;
    }
    if (kind === 'u') {
      paths.push(fieldAfterSpaces(record, 10));
      continue;
    }
    if (record.startsWith('# ')) continue;
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git status record kind is unsupported');
  }
  return [...new Set(paths)].sort();
}

function parseDiffTree(bytes: Uint8Array): readonly GitCommitDiffEntry[] {
  const fields = decode(bytes).split('\u0000');
  const entries: GitCommitDiffEntry[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index];
    if (status === undefined || status.length === 0) break;
    const path = fields[index + 1];
    if (path === undefined || path.length === 0 || !/^[A-Z][0-9]*$/u.test(status)) {
      throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git commit diff output is malformed');
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      const nextPath = fields[index + 2];
      if (nextPath === undefined || nextPath.length === 0) {
        throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git rename/copy diff output is incomplete');
      }
      entries.push({ status, path: nextPath, priorPath: path });
      index += 3;
    } else {
      entries.push({ status, path });
      index += 2;
    }
  }
  return entries;
}

function fieldAfterSpaces(record: string, count: number): string {
  let offset = -1;
  for (let found = 0; found < count; found += 1) {
    offset = record.indexOf(' ', offset + 1);
    if (offset < 0) {
      throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git status record is truncated');
    }
  }
  const value = record.slice(offset + 1);
  if (value.length === 0) {
    throw new ObservationError('STRUCTURED_OUTPUT_INVALID', 'Git status path is empty');
  }
  return value;
}

function latestCompletion(results: readonly ToolReadResult[]): string {
  return results.map((result) => result.completedAt).sort().at(-1) ?? '1970-01-01T00:00:00.000Z';
}
