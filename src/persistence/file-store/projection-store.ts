import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { MissionProjection } from '../../application/projections/mission-projector.js';
import { hashCanonical } from './hashing.js';
import { ensurePrivateDirectory, isNodeError, validateStateRoot } from './path-safety.js';
import { writeAtomicCanonicalJson } from './atomic-file.js';

interface ProjectionDocument {
  readonly schemaVersion: 'agent-office.projection-document.v1';
  readonly sourceSequence: number;
  readonly sourceEventHash: string;
  readonly projectionHash: string;
  readonly projection: MissionProjection;
}

export class ProjectionStore {
  private constructor(private readonly root: string) {}

  public static async open(root: string): Promise<ProjectionStore> {
    return new ProjectionStore(await validateStateRoot(root));
  }

  public async publish(projection: MissionProjection): Promise<void> {
    const directory = await ensurePrivateDirectory(this.root, 'projections');
    const document: ProjectionDocument = {
      schemaVersion: 'agent-office.projection-document.v1',
      sourceSequence: projection.sequence,
      sourceEventHash: projection.eventHash,
      projectionHash: hashCanonical(projection),
      projection,
    };
    await writeAtomicCanonicalJson(path.join(directory, `${projection.missionId}.json`), document);
  }

  public async load(missionId: string): Promise<MissionProjection | undefined> {
    try {
      const document = JSON.parse(
        await readFile(path.join(this.root, 'projections', `${missionId}.json`), 'utf8'),
      ) as ProjectionDocument;
      if (
        document.schemaVersion !== 'agent-office.projection-document.v1' ||
        document.sourceSequence !== document.projection.sequence ||
        document.sourceEventHash !== document.projection.eventHash ||
        document.projectionHash !== hashCanonical(document.projection)
      ) {
        return undefined;
      }
      return document.projection;
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return undefined;
      return undefined;
    }
  }
}
