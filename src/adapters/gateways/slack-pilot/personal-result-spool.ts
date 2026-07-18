// AS1 Multi-Team Slack Pilot — PERSONAL_LEO_ONLY direct local-result spool (handoff 119).
//
// A single, fixed, CONTAINED local hand-off between the one fixed Advisor result action (writer) and the foreground
// Gateway owner (consumer). It is NOT a generic IPC/workflow framework: the only payload is a bounded answer plus the
// message's own already-derived immutable same-thread routing (requestId / sourceEventId / channel / thread_ts). No
// Git, evidence artifact/hash, receive grant, or provenance participates. Entries live under a private leo-v1 subdir;
// a written entry is claimed and marked exactly once so the owner consumes each result a single time.
import { mkdir, open, readdir, rename } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../../contracts/types.js';
import { canonicalBytes } from '../../../persistence/file-store/canonical-json.js';
import { requireBoundedMessageText } from '../../../application/slack-pilot/contracts.js';

const SPOOL_DIRNAME = 'personal-result-spool';
const CONTAINED_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const PENDING_SUFFIX = '.pending.json';

/** The bounded, self-routing local result the Advisor action spools and the owner posts to the immutable same thread. */
export interface As1PersonalResultEntry {
  readonly requestId: string;
  readonly sourceEventId: string;
  readonly channel: string;
  readonly threadTs: string;
  readonly answerText: string;
}

export interface As1PersonalResultSpool {
  /** Write exactly one pending result for `requestId`; a duplicate write for the same request fails closed (idempotent). */
  write(entry: As1PersonalResultEntry): Promise<void>;
  /** Return the oldest pending result without removing it, or null when the spool is empty. */
  consumeOne(): Promise<As1PersonalResultEntry | null>;
  /** Mark a consumed result complete so it is never consumed again. */
  markComplete(requestId: string): Promise<void>;
  /** Mark a consumed result a message-local failure (kept out of pending) so the next message proceeds. */
  markFailed(requestId: string): Promise<void>;
}

function requireContainedId(value: string, label: string): string {
  if (!CONTAINED_ID.test(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not a bounded contained identity`);
  }
  return value;
}

function parseEntry(bytes: Buffer, label: string): As1PersonalResultEntry {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new DomainError('INVALID_SCHEMA', `${label} is not valid JSON`);
  }
  if (typeof value !== 'object' || value === null) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not an object`);
  }
  const record = value as Record<string, unknown>;
  const str = (key: string): string => {
    const v = record[key];
    if (typeof v !== 'string') throw new DomainError('INVALID_SCHEMA', `${label} ${key} is not a string`);
    return v;
  };
  return {
    requestId: requireContainedId(str('requestId'), 'personal result requestId'),
    sourceEventId: requireContainedId(str('sourceEventId'), 'personal result sourceEventId'),
    channel: requireContainedId(str('channel'), 'personal result channel'),
    threadTs: str('threadTs'),
    answerText: requireBoundedMessageText(str('answerText'), 'personal result answerText'),
  };
}

/** The only implementation: a private per-leo-v1 spool directory holding one file per message result. */
export class As1FilePersonalResultSpool implements As1PersonalResultSpool {
  private constructor(private readonly dir: string) {}

  public static async open(stateRoot: string): Promise<As1FilePersonalResultSpool> {
    const dir = path.join(stateRoot, SPOOL_DIRNAME);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    return new As1FilePersonalResultSpool(dir);
  }

  private pendingPath(requestId: string): string {
    return path.join(this.dir, `${requireContainedId(requestId, 'personal result requestId')}${PENDING_SUFFIX}`);
  }

  public async write(entry: As1PersonalResultEntry): Promise<void> {
    const canonical: As1PersonalResultEntry = {
      requestId: requireContainedId(entry.requestId, 'personal result requestId'),
      sourceEventId: requireContainedId(entry.sourceEventId, 'personal result sourceEventId'),
      channel: requireContainedId(entry.channel, 'personal result channel'),
      threadTs: entry.threadTs,
      answerText: requireBoundedMessageText(entry.answerText, 'personal result answerText'),
    };
    const bytes = Buffer.concat([canonicalBytes(canonical), Buffer.from('\n', 'utf8')]);
    let handle: import('node:fs/promises').FileHandle | undefined;
    try {
      // O_EXCL|O_NOFOLLOW: a duplicate write for the same request (already-terminal) fails closed; never follow a symlink.
      handle = await open(this.pendingPath(canonical.requestId), 'wx', 0o600);
      await handle.write(bytes, 0, bytes.byteLength, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'a personal result is already spooled for this request');
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  public async consumeOne(): Promise<As1PersonalResultEntry | null> {
    const names = (await readdir(this.dir)).filter((name) => name.endsWith(PENDING_SUFFIX)).sort();
    const next = names[0];
    if (next === undefined) return null;
    let handle: import('node:fs/promises').FileHandle | undefined;
    try {
      handle = await open(path.join(this.dir, next), 'r');
      const bytes = await handle.readFile();
      return parseEntry(bytes, 'spooled personal result');
    } finally {
      await handle?.close();
    }
  }

  public async markComplete(requestId: string): Promise<void> {
    await this.moveOut(requestId, '.done.json');
  }

  public async markFailed(requestId: string): Promise<void> {
    await this.moveOut(requestId, '.failed.json');
  }

  private async moveOut(requestId: string, terminalSuffix: string): Promise<void> {
    const id = requireContainedId(requestId, 'personal result requestId');
    await rename(this.pendingPath(id), path.join(this.dir, `${id}${terminalSuffix}`));
  }
}
