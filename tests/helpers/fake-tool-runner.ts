import type {
  GitReadRequest,
  ReadonlyToolRunner,
  TmuxReadRequest,
  ToolReadResult,
} from '../../src/adapters/observations/process-runner.js';

export class FakeReadonlyToolRunner implements ReadonlyToolRunner {
  public readonly gitRequests: GitReadRequest[] = [];
  public readonly tmuxRequests: TmuxReadRequest[] = [];

  public constructor(
    private readonly gitHandler: (request: GitReadRequest) => Promise<ToolReadResult> | ToolReadResult,
    private readonly tmuxHandler: (request: TmuxReadRequest) => Promise<ToolReadResult> | ToolReadResult = () =>
      toolResult(''),
  ) {}

  public async readGit(request: GitReadRequest): Promise<ToolReadResult> {
    this.gitRequests.push(request);
    return this.gitHandler(request);
  }

  public async readTmux(request: TmuxReadRequest): Promise<ToolReadResult> {
    this.tmuxRequests.push(request);
    return this.tmuxHandler(request);
  }
}

export function toolResult(
  stdout: string,
  exitCode = 0,
  completedAt = '2026-07-10T20:00:00.000Z',
): ToolReadResult {
  return {
    exitCode,
    stdout: Buffer.from(stdout, 'utf8'),
    stderr: new Uint8Array(),
    completedAt,
  };
}
