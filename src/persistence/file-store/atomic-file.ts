import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { canonicalBytes } from './canonical-json.js';
import { FILE_MODE, fsyncDirectory } from './path-safety.js';

export async function writeAtomicBytes(filePath: string, bytes: Uint8Array): Promise<void> {
  const directory = path.dirname(filePath);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`);
  let handle: import('node:fs/promises').FileHandle | undefined;
  try {
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, FILE_MODE);
    const result = await handle.write(bytes, 0, bytes.byteLength, 0);
    if (result.bytesWritten !== bytes.byteLength) throw new Error('short atomic file write');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, filePath);
    await fsyncDirectory(directory);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function writeAtomicCanonicalJson(filePath: string, value: unknown): Promise<void> {
  await writeAtomicBytes(filePath, Buffer.concat([canonicalBytes(value), Buffer.from('\n', 'utf8')]));
}
