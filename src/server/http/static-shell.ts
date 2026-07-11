import { constants } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { StoreError } from '../../persistence/file-store/errors.js';
import { isNodeError } from '../../persistence/file-store/path-safety.js';
import { applySecurityHeaders } from '../security/headers.js';
import { HttpBoundaryError } from './errors.js';

const MAX_STATIC_BYTES = 8 * 1024 * 1024;
const HASHED_ASSET = /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*-[A-Za-z0-9_-]{8,}\.(?:css|js|png|svg|woff2)$/u;

interface StaticDescriptor {
  readonly relativePath: string;
  readonly contentType: string;
  readonly immutable: boolean;
  readonly serviceWorker: boolean;
}

const EXACT_STATIC_PATHS: Readonly<Record<string, StaticDescriptor>> = {
  '/': descriptor('index.html', 'text/html; charset=utf-8'),
  '/index.html': descriptor('index.html', 'text/html; charset=utf-8'),
  '/manifest.webmanifest': descriptor('manifest.webmanifest', 'application/manifest+json; charset=utf-8'),
  '/sw.js': { ...descriptor('sw.js', 'text/javascript; charset=utf-8'), serviceWorker: true },
  '/icons/agent-office.svg': descriptor('icons/agent-office.svg', 'image/svg+xml; charset=utf-8'),
  '/icons/agent-office-maskable.svg': descriptor(
    'icons/agent-office-maskable.svg',
    'image/svg+xml; charset=utf-8',
  ),
};

export class StaticShell {
  private constructor(private readonly root: string) {}

  public static async open(root: string): Promise<StaticShell> {
    if (!path.isAbsolute(root)) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'static shell root must be absolute');
    }
    const info = await lstat(root);
    const currentUid = process.getuid?.();
    if (
      info.isSymbolicLink() ||
      !info.isDirectory() ||
      (currentUid !== undefined && info.uid !== currentUid)
    ) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'static shell root is invalid');
    }
    return new StaticShell(await realpath(root));
  }

  public async tryServe(pathname: string, response: ServerResponse): Promise<boolean> {
    const target = staticDescriptor(pathname);
    if (target === undefined) return false;
    const filePath = path.join(this.root, target.relativePath);
    let handle: import('node:fs/promises').FileHandle;
    try {
      handle = await open(
        filePath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        throw new HttpBoundaryError('ROUTE_NOT_FOUND', 404, 'static shell asset is absent');
      }
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'static shell asset could not be opened', {
        cause: error,
      });
    }
    let bytes: Buffer;
    try {
      const info = await handle.stat();
      const currentUid = process.getuid?.();
      if (
        !info.isFile() ||
        (currentUid !== undefined && info.uid !== currentUid) ||
        !Number.isSafeInteger(info.size) ||
        info.size < 0 ||
        info.size > MAX_STATIC_BYTES
      ) {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'static shell asset is invalid');
      }
      bytes = await handle.readFile();
      if (bytes.byteLength !== info.size || bytes.byteLength > MAX_STATIC_BYTES) {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'static shell asset changed during read');
      }
    } finally {
      await handle.close();
    }
    applySecurityHeaders(response, target.immutable ? 'STATIC_IMMUTABLE' : 'REVALIDATE');
    response.statusCode = 200;
    response.setHeader('Content-Type', target.contentType);
    response.setHeader('Content-Length', String(bytes.byteLength));
    if (target.serviceWorker) response.setHeader('Service-Worker-Allowed', '/');
    response.end(bytes);
    return true;
  }
}

export function isStaticShellPath(pathname: string): boolean {
  return staticDescriptor(pathname) !== undefined;
}

function staticDescriptor(pathname: string): StaticDescriptor | undefined {
  const exact = EXACT_STATIC_PATHS[pathname];
  if (exact !== undefined) return exact;
  if (!HASHED_ASSET.test(pathname)) return undefined;
  const extension = path.extname(pathname);
  const contentType = extension === '.css'
    ? 'text/css; charset=utf-8'
    : extension === '.js'
      ? 'text/javascript; charset=utf-8'
      : extension === '.woff2'
        ? 'font/woff2'
        : extension === '.svg'
          ? 'image/svg+xml; charset=utf-8'
          : 'image/png';
  return {
    relativePath: pathname.slice(1),
    contentType,
    immutable: true,
    serviceWorker: false,
  };
}

function descriptor(relativePath: string, contentType: string): StaticDescriptor {
  return { relativePath, contentType, immutable: false, serviceWorker: false };
}
