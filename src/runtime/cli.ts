import path from 'node:path';

import { DomainError } from '../contracts/types.js';
import { StoreError } from '../persistence/file-store/errors.js';
import { loadPrivateDeploymentConfiguration } from '../server/config.js';
import { HttpBoundaryError } from '../server/http/errors.js';
import { startAgentOfficeComposition } from './composition.js';

interface CliOptions {
  readonly appRoot: string;
  readonly configPath: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const configuration = await loadPrivateDeploymentConfiguration(options.configPath);
  const composition = await startAgentOfficeComposition({
    configuration,
    appRoot: options.appRoot,
    stateRoot: options.stateRoot,
    staticRoot: options.staticRoot,
    manifestPath: path.join(options.appRoot, 'fixtures/manifests/agent-office-m01.v1.json'),
    manifestSourcePath: path.join(
      options.appRoot,
      'fixtures/manifests/agent-office-m01.v1.source.json',
    ),
    buildId: 'agent-office-m01-final-rework',
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'agent-office.runtime-start.v1',
    origins: composition.origins,
    status: composition.readStatus(),
  })}\n`);
  const signal = await waitForShutdownSignal();
  await composition.close();
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'agent-office.runtime-stop.v1',
    signal,
    listenerClosed: true,
    writerLockReleased: true,
  })}\n`);
}

function parseArguments(argumentsList: readonly string[]): CliOptions {
  const appRootDefault = path.resolve(import.meta.dirname, '../../..');
  const values = new Map<string, string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const key = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      !['--app-root', '--config', '--state-root', '--static-root'].includes(key) ||
      values.has(key)
    ) {
      throw new DomainError('INVALID_SCHEMA', 'runtime arguments are invalid');
    }
    values.set(key, value);
  }
  const appRoot = path.resolve(values.get('--app-root') ?? appRootDefault);
  const stateRootValue = values.get('--state-root');
  if (stateRootValue === undefined || !path.isAbsolute(stateRootValue)) {
    throw new DomainError('INVALID_SCHEMA', '--state-root must be an explicit absolute path');
  }
  return {
    appRoot,
    configPath: path.resolve(
      values.get('--config') ?? path.join(appRoot, 'config/agent-office.loopback.json'),
    ),
    stateRoot: stateRootValue,
    staticRoot: path.resolve(values.get('--static-root') ?? path.join(appRoot, 'dist/dashboard')),
  };
}

function waitForShutdownSignal(): Promise<'SIGINT' | 'SIGTERM'> {
  return new Promise((resolve) => {
    const stop = (signal: 'SIGINT' | 'SIGTERM'): void => {
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
      resolve(signal);
    };
    const onInterrupt = (): void => stop('SIGINT');
    const onTerminate = (): void => stop('SIGTERM');
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
  });
}

function errorCode(error: unknown): string {
  if (error instanceof DomainError || error instanceof StoreError || error instanceof HttpBoundaryError) {
    return error.code;
  }
  return 'APPLICATION_REJECTED';
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 'agent-office.runtime-error.v1',
    code: errorCode(error),
  })}\n`);
  process.exitCode = 1;
});
