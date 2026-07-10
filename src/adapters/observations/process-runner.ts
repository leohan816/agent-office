import { spawn } from 'node:child_process';
import path from 'node:path';

import { ObservationError } from './errors.js';

const COMMIT = /^[0-9a-f]{40}$/u;
const REF_PREFIX = /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u;
const PANE_ID = /^%[0-9]+$/u;

export interface ToolReadLimits {
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

export type GitReadRequest =
  | { readonly kind: 'TOP_LEVEL'; readonly cwd: string; readonly limits: ToolReadLimits }
  | { readonly kind: 'HEAD'; readonly cwd: string; readonly limits: ToolReadLimits }
  | { readonly kind: 'UPSTREAM_NAME'; readonly cwd: string; readonly limits: ToolReadLimits }
  | { readonly kind: 'UPSTREAM_COMMIT'; readonly cwd: string; readonly limits: ToolReadLimits }
  | { readonly kind: 'STATUS'; readonly cwd: string; readonly limits: ToolReadLimits }
  | {
      readonly kind: 'ALLOWLISTED_REFS';
      readonly cwd: string;
      readonly refPrefix: string;
      readonly limits: ToolReadLimits;
    }
  | {
      readonly kind: 'ANCESTRY';
      readonly cwd: string;
      readonly baseCommit: string;
      readonly headCommit: string;
      readonly limits: ToolReadLimits;
    }
  | {
      readonly kind: 'COMMIT_DIFF';
      readonly cwd: string;
      readonly baseCommit: string;
      readonly headCommit: string;
      readonly limits: ToolReadLimits;
    };

export interface TmuxReadRequest {
  readonly kind: 'EXACT_PANE_METADATA';
  readonly paneId: string;
  readonly limits: ToolReadLimits;
}

export interface ToolReadResult {
  readonly exitCode: number;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly completedAt: string;
}

export interface ReadonlyToolRunner {
  readGit(request: GitReadRequest): Promise<ToolReadResult>;
  readTmux(request: TmuxReadRequest): Promise<ToolReadResult>;
}

export const TMUX_METADATA_FORMAT = [
  '#{session_id}',
  '#{window_id}',
  '#{pane_id}',
  '#{q:session_name}',
  '#{q:window_name}',
  '#{window_index}',
  '#{pane_index}',
  '#{q:pane_current_path}',
  '#{q:pane_current_command}',
  '#{pane_dead}',
  '#{window_activity}',
  '#{synchronize-panes}',
].join('\u001f');

export function gitReadArgv(request: GitReadRequest): readonly string[] {
  validateAbsoluteCwd(request.cwd);
  validateLimits(request.limits);
  switch (request.kind) {
    case 'TOP_LEVEL':
      return ['rev-parse', '--show-toplevel'];
    case 'HEAD':
      return ['rev-parse', '--verify', 'HEAD^{commit}'];
    case 'UPSTREAM_NAME':
      return ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'];
    case 'UPSTREAM_COMMIT':
      return ['rev-parse', '--verify', '@{upstream}^{commit}'];
    case 'STATUS':
      return ['status', '--porcelain=v2', '-z', '--untracked-files=all'];
    case 'ALLOWLISTED_REFS':
      if (!REF_PREFIX.test(request.refPrefix) || request.refPrefix.includes('..')) {
        throw new ObservationError('CONFIG_INVALID', 'Git ref prefix is not an exact trusted namespace');
      }
      return ['for-each-ref', '--format=%(refname)%09%(objectname)', request.refPrefix];
    case 'ANCESTRY':
      validateCommitPair(request.baseCommit, request.headCommit);
      return ['merge-base', '--is-ancestor', request.baseCommit, request.headCommit];
    case 'COMMIT_DIFF':
      validateCommitPair(request.baseCommit, request.headCommit);
      return [
        'diff-tree',
        '--no-commit-id',
        '--name-status',
        '-r',
        '-z',
        request.baseCommit,
        request.headCommit,
        '--',
      ];
  }
}

export function tmuxReadArgv(request: TmuxReadRequest): readonly string[] {
  validateLimits(request.limits);
  if (!PANE_ID.test(request.paneId)) {
    throw new ObservationError('CONFIG_INVALID', 'tmux pane identity is not exact');
  }
  return ['display-message', '-p', '-t', request.paneId, '-F', TMUX_METADATA_FORMAT];
}

export class NodeReadonlyToolRunner implements ReadonlyToolRunner {
  public constructor(
    private readonly executables: {
      readonly git: string;
      readonly tmux: string;
    } = { git: '/usr/bin/git', tmux: '/usr/bin/tmux' },
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    if (!path.isAbsolute(executables.git) || !path.isAbsolute(executables.tmux)) {
      throw new ObservationError('CONFIG_INVALID', 'tool executables must be trusted absolute paths');
    }
  }

  public readGit(request: GitReadRequest): Promise<ToolReadResult> {
    return this.runRead(this.executables.git, gitReadArgv(request), request.cwd, request.limits, {
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0',
    });
  }

  public readTmux(request: TmuxReadRequest): Promise<ToolReadResult> {
    return this.runRead(this.executables.tmux, tmuxReadArgv(request), '/', request.limits, {});
  }

  private runRead(
    executable: string,
    argv: readonly string[],
    cwd: string,
    limits: ToolReadLimits,
    toolEnvironment: Readonly<Record<string, string>>,
  ): Promise<ToolReadResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, argv, {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          HOME: '/nonexistent',
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8',
          PATH: '/usr/bin:/bin',
          ...toolEnvironment,
        },
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let byteCount = 0;
      let settled = false;
      const finishWithError = (error: ObservationError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(error);
      };
      const collect = (target: Buffer[], chunk: Buffer): void => {
        byteCount += chunk.byteLength;
        if (byteCount > limits.maxOutputBytes) {
          finishWithError(new ObservationError('OUTPUT_LIMIT_EXCEEDED', 'read-only tool output cap exceeded'));
          return;
        }
        target.push(chunk);
      };
      const timer = setTimeout(() => {
        finishWithError(new ObservationError('TOOL_TIMEOUT', 'read-only tool timeout exceeded'));
      }, limits.timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        collect(stdout, chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        collect(stderr, chunk);
      });
      child.once('error', (error) => {
        finishWithError(new ObservationError('TOOL_FAILED', 'read-only tool failed to start', { cause: error }));
      });
      child.once('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode: code ?? -1,
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr),
          completedAt: this.now(),
        });
      });
    });
  }
}

function validateLimits(limits: ToolReadLimits): void {
  if (
    !Number.isSafeInteger(limits.timeoutMs) ||
    !Number.isSafeInteger(limits.maxOutputBytes) ||
    limits.timeoutMs < 1 ||
    limits.timeoutMs > 30_000 ||
    limits.maxOutputBytes < 1 ||
    limits.maxOutputBytes > 4 * 1024 * 1024
  ) {
    throw new ObservationError('CONFIG_INVALID', 'tool read limits are outside the fixed safe range');
  }
}

function validateAbsoluteCwd(cwd: string): void {
  if (!path.isAbsolute(cwd)) {
    throw new ObservationError('CONFIG_INVALID', 'Git cwd must come from an absolute trusted root');
  }
}

function validateCommitPair(baseCommit: string, headCommit: string): void {
  if (!COMMIT.test(baseCommit) || !COMMIT.test(headCommit)) {
    throw new ObservationError('CONFIG_INVALID', 'Git commit pair must contain exact object IDs');
  }
}
