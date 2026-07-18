// AS1 Multi-Team Slack Pilot — PERSONAL_LEO_ONLY direct local-result spool (handoff 119).
//
// A single, fixed, CONTAINED cross-process hand-off between three fixed actors on the same host: the foreground
// Gateway records the delivered message's own correlation (`recordCorrelation`), the separate fixed Advisor process
// invokes the ONE production answer action which derives that sole pending correlation from here and attaches bounded
// answer text (`takePending` + `answer`), and the foreground owner automatically consumes the answered result and
// posts it to the immutable same thread (`consumeAnswered`). It is NOT a generic IPC/workflow framework: the only
// payload is the message's own already-derived same-thread routing plus one bounded answer. No Git, evidence, receive
// grant, or provenance participates. Entries live under a private leo-v1 subdir; each result is marked exactly once.
import { mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../../contracts/types.js';
import { canonicalBytes } from '../../../persistence/file-store/canonical-json.js';
import { requireBoundedMessageText } from '../../../application/slack-pilot/contracts.js';

const SPOOL_DIRNAME = 'personal-result-spool';
const CONTAINED_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const PENDING_SUFFIX = '.pending.json';
const READY_SUFFIX = '.ready.json';

/** The delivered message's own self-routing correlation — never a caller value. Recorded by the Gateway on delivery. */
export interface As1PersonalCorrelation {
  readonly requestId: string;
  readonly sourceEventId: string;
  readonly channel: string;
  readonly threadTs: string;
}

/** A correlation plus the bounded Advisor answer, ready for the foreground owner to post to the same thread. */
export interface As1PersonalResultEntry extends As1PersonalCorrelation {
  readonly answerText: string;
}

export interface As1PersonalResultSpool {
  /** Foreground, AFTER successful delivery: record the sole pending correlation. An IDENTICAL current correlation is
   *  idempotent; a DIFFERENT one is refused (a conflicting/stale pending never overwrites). */
  recordCorrelation(correlation: As1PersonalCorrelation): Promise<void>;
  /** Foreground: discard any pending correlation not yet answered (message-local cleanup on reset/failure). */
  discardPending(): Promise<void>;
  /** Fixed answer action: the sole pending correlation awaiting an answer, or null. */
  takePending(): Promise<As1PersonalCorrelation | null>;
  /** Fixed answer action: attach bounded answer text to a pending correlation, making it ready to post. */
  answer(requestId: string, answerText: string): Promise<void>;
  /** Foreground owner: the sole answered result to post, or null. */
  consumeAnswered(): Promise<As1PersonalResultEntry | null>;
  /** Foreground owner: mark a consumed result complete (never consumed again). */
  markComplete(requestId: string): Promise<void>;
  /** Foreground owner: mark a consumed result a message-local failure (the next message proceeds). */
  markFailed(requestId: string): Promise<void>;
}

function requireContainedId(value: string, label: string): string {
  if (!CONTAINED_ID.test(value)) throw new DomainError('INVALID_SCHEMA', `${label} is not a bounded contained identity`);
  return value;
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const v = record[key];
  if (typeof v !== 'string') throw new DomainError('INVALID_SCHEMA', `${label} ${key} is not a string`);
  return v;
}

function parseRecord(bytes: Buffer, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new DomainError('INVALID_SCHEMA', `${label} is not valid JSON`);
  }
  if (typeof value !== 'object' || value === null) throw new DomainError('INVALID_SCHEMA', `${label} is not an object`);
  return value as Record<string, unknown>;
}

function parseCorrelation(record: Record<string, unknown>, label: string): As1PersonalCorrelation {
  return {
    requestId: requireContainedId(readString(record, 'requestId', label), 'personal result requestId'),
    sourceEventId: requireContainedId(readString(record, 'sourceEventId', label), 'personal result sourceEventId'),
    channel: requireContainedId(readString(record, 'channel', label), 'personal result channel'),
    threadTs: readString(record, 'threadTs', label),
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

  private async writeExclusive(name: string, value: unknown): Promise<void> {
    const bytes = Buffer.concat([canonicalBytes(value), Buffer.from('\n', 'utf8')]);
    let handle: import('node:fs/promises').FileHandle | undefined;
    try {
      handle = await open(path.join(this.dir, name), 'wx', 0o600); // O_EXCL: a duplicate for the same request fails closed
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

  private async readFirst(suffix: string): Promise<{ readonly name: string; readonly record: Record<string, unknown> } | null> {
    const next = (await readdir(this.dir)).filter((n) => n.endsWith(suffix)).sort()[0];
    if (next === undefined) return null;
    let handle: import('node:fs/promises').FileHandle | undefined;
    try {
      handle = await open(path.join(this.dir, next), 'r');
      return { name: next, record: parseRecord(await handle.readFile(), 'spooled personal result') };
    } finally {
      await handle?.close();
    }
  }

  public async recordCorrelation(correlation: As1PersonalCorrelation): Promise<void> {
    const id = requireContainedId(correlation.requestId, 'personal result requestId');
    const next: As1PersonalCorrelation = {
      requestId: id,
      sourceEventId: requireContainedId(correlation.sourceEventId, 'personal result sourceEventId'),
      channel: requireContainedId(correlation.channel, 'personal result channel'),
      threadTs: correlation.threadTs,
    };
    const existing = await this.readFirst(PENDING_SUFFIX);
    if (existing !== null) {
      const prev = parseCorrelation(existing.record, 'pending personal correlation');
      if (prev.requestId === next.requestId && prev.sourceEventId === next.sourceEventId && prev.channel === next.channel && prev.threadTs === next.threadTs) {
        return; // idempotent: the IDENTICAL current correlation is already pending
      }
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'a different personal correlation is already pending');
    }
    await this.writeExclusive(`${id}${PENDING_SUFFIX}`, next);
  }

  public async discardPending(): Promise<void> {
    const existing = await this.readFirst(PENDING_SUFFIX);
    if (existing !== null) await unlink(path.join(this.dir, existing.name)).catch(() => undefined);
  }

  public async takePending(): Promise<As1PersonalCorrelation | null> {
    const found = await this.readFirst(PENDING_SUFFIX);
    return found === null ? null : parseCorrelation(found.record, 'pending personal correlation');
  }

  public async answer(requestId: string, answerText: string): Promise<void> {
    const id = requireContainedId(requestId, 'personal result requestId');
    const found = await this.readFirst(PENDING_SUFFIX);
    if (found?.name !== `${id}${PENDING_SUFFIX}`) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'no pending personal correlation for this request');
    }
    const correlation = parseCorrelation(found.record, 'pending personal correlation');
    await this.writeExclusive(`${id}${READY_SUFFIX}`, { ...correlation, answerText: requireBoundedMessageText(answerText, 'personal result answerText') });
    await rename(path.join(this.dir, found.name), path.join(this.dir, `${id}.answered.json`));
  }

  public async consumeAnswered(): Promise<As1PersonalResultEntry | null> {
    const found = await this.readFirst(READY_SUFFIX);
    if (found === null) return null;
    return { ...parseCorrelation(found.record, 'ready personal result'), answerText: requireBoundedMessageText(readString(found.record, 'answerText', 'ready personal result'), 'personal result answerText') };
  }

  public async markComplete(requestId: string): Promise<void> {
    await this.moveOut(requestId, '.done.json');
  }

  public async markFailed(requestId: string): Promise<void> {
    await this.moveOut(requestId, '.failed.json');
  }

  private async moveOut(requestId: string, terminalSuffix: string): Promise<void> {
    const id = requireContainedId(requestId, 'personal result requestId');
    await rename(path.join(this.dir, `${id}${READY_SUFFIX}`), path.join(this.dir, `${id}${terminalSuffix}`));
  }
}
