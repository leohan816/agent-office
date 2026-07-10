import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { MissionProjection } from '../../application/projections/mission-projector.js';
import { canonicalize } from './canonical-json.js';
import { hashCanonical } from './hashing.js';
import { ensurePrivateDirectory, isNodeError, validateStateRoot } from './path-safety.js';
import { writeAtomicCanonicalJson } from './atomic-file.js';

export interface ProjectionCheckpoint {
  readonly schemaVersion: 'agent-office.projection-checkpoint.v1';
  readonly missionId: string;
  readonly sequence: number;
  readonly eventHash: string;
  readonly projectionHash: string;
  readonly projection: MissionProjection;
}

export class CheckpointStore {
  private constructor(private readonly root: string) {}

  public static async open(root: string): Promise<CheckpointStore> {
    return new CheckpointStore(await validateStateRoot(root));
  }

  public async save(projection: MissionProjection): Promise<ProjectionCheckpoint> {
    const checkpoint: ProjectionCheckpoint = {
      schemaVersion: 'agent-office.projection-checkpoint.v1',
      missionId: projection.missionId,
      sequence: projection.sequence,
      eventHash: projection.eventHash,
      projectionHash: hashCanonical(projection),
      projection,
    };
    const directory = await ensurePrivateDirectory(this.root, 'checkpoints');
    await writeAtomicCanonicalJson(path.join(directory, `${projection.missionId}.json`), checkpoint);
    return checkpoint;
  }

  public async load(missionId: string): Promise<ProjectionCheckpoint | undefined> {
    const filePath = path.join(this.root, 'checkpoints', `${missionId}.json`);
    try {
      const checkpoint = JSON.parse(await readFile(filePath, 'utf8')) as ProjectionCheckpoint;
      if (
        checkpoint.schemaVersion !== 'agent-office.projection-checkpoint.v1' ||
        checkpoint.missionId !== missionId ||
        checkpoint.sequence !== checkpoint.projection.sequence ||
        checkpoint.eventHash !== checkpoint.projection.eventHash ||
        checkpoint.projectionHash !== hashCanonical(checkpoint.projection)
      ) {
        return undefined;
      }
      canonicalize(checkpoint);
      return checkpoint;
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return undefined;
      return undefined;
    }
  }
}
