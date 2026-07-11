import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  parseOperationalRuntimeConfiguration,
} from '../../src/runtime/operational-config.js';
import { normalizeOfficeStationId } from '../../src/ui/scene/types.js';
import { operationalRuntimeConfiguration, projectRoot } from '../helpers/operational-runtime.js';

const latin = String.fromCodePoint(115, 104, 97, 115, 104, 117);
const korean = String.fromCodePoint(0xc0e4, 0xc288);

describe('AO12-IWU-04 SIASIU current product naming', () => {
  it('preserves only the current station ID and canonical actor label', async () => {
    expect(normalizeOfficeStationId('siasiu')).toBe('siasiu');
    for (const value of [latin, latin.toUpperCase(), titleCase(latin), korean]) {
      expect(normalizeOfficeStationId(value)).toBeUndefined();
    }

    const configuration = await operationalRuntimeConfiguration();
    const parsed = parseOperationalRuntimeConfiguration(configuration);
    expect(parsed.actors.find((actor) => actor.stationId === 'siasiu')).toMatchObject({
      roleInstanceId: 'siasiu-role',
      stationId: 'siasiu',
      actorRole: 'SIASIU Worker',
      tmuxSourceId: 'siasiu-tmux',
    });
    expect(parsed.tmuxSources.find((source) => source.sourceId === 'siasiu-tmux')).toMatchObject({
      windowNameEscaped: 'siasiu',
    });
  });

  it('rejects forbidden current names instead of normalizing authority or source identity', async () => {
    const base = await operationalRuntimeConfiguration();
    for (const value of [latin, latin.toUpperCase(), titleCase(latin), korean]) {
      const configuration = structuredClone(base);
      const index = configuration.actors.findIndex((actor) => actor.stationId === 'siasiu');
      const actor = configuration.actors[index];
      if (actor === undefined) throw new Error('SIASIU fixture actor missing');
      (configuration.actors as unknown as Record<string, unknown>[])[index] = {
        ...actor,
        actorRole: `${value} Worker`,
      };
      expect(() => parseOperationalRuntimeConfiguration(configuration), value).toThrow(
        /forbidden current product name/u,
      );
    }
  });

  it('scans current product paths, tests, fixtures, locale resources, and baselines', () => {
    const result = spawnSync(process.execPath, ['scripts/check-current-product-name.mjs'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^Current product name gate passed: \d+ files scanned\.\n$/u);
  });
});

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
