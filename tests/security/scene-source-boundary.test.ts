import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
  composeLivingOfficeProductionRenderInput,
  parseLivingOfficeProductionRenderInput,
  projectOrganizationFrame,
} from '../../src/application/organization/index.js';
import { ORGANIZATION_EVIDENCE, ORGANIZATION_REGISTRY } from '../../fixtures/organization-registry.js';
import { projectLivingOfficeFrame } from '../../src/ui/pixel/production-frame-projector.js';
import type { LivingOfficePresentationV1 } from '../../src/runtime/projection.js';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const EVALUATED_AT = '2026-07-12T00:00:00.000Z';

// Contract §5: symbolic facility/work surfaces MUST NOT render terminal output, source code, file
// paths, raw locators, credentials, secrets, or private/raw operational content.
const FORBIDDEN_CONTENT: readonly RegExp[] = [
  /\/home\/|\/Users\/|[A-Za-z]:\\/u,        // absolute filesystem paths / raw locators
  /sha256:[0-9a-f]{8}/u,                     // committed evidence hashes / credential digests
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/u, // private key material
  /\bpassword\b|\bsecret\b|\bapi[_-]?key\b|\bbearer\b/iu, // credential words
  /\$\s+\w|\bstderr\b|\bstdout\b|node_modules|\bnpm run\b/u, // terminal prose / source
  /process\.env|\.env\b/u,                   // environment values
];

function livingOfficeFrame() {
  const operational: LivingOfficePresentationV1 = {
    schemaVersion: 'agent-office.living-office-presentation.v1',
    projectionRevision: 0,
    evaluatedAt: EVALUATED_AT,
    frame: projectOrganizationFrame({
      registry: ORGANIZATION_REGISTRY,
      evidence: ORGANIZATION_EVIDENCE,
      runtime: [{ roleInstanceId: 'agent-office-worker', mission: 'MODERN_OFFICE', workUnit: 'BA-WU-05', observableName: 'WORKING' }],
      evaluatedAt: EVALUATED_AT,
    }),
  };
  const result = parseLivingOfficeProductionRenderInput(composeLivingOfficeProductionRenderInput({
    operational,
    committedLayout: COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
    viewport: { width: 1400, height: 800 },
    selectedPodId: 'pod:foundation',
    logicalTimeMs: 0,
  }));
  if (!result.ok) throw new Error('living office render input rejected');
  return projectLivingOfficeFrame(result.value, { presentationTier: 'PIXEL_FULL' });
}

function collectRenderedStrings(): readonly string[] {
  const frame = livingOfficeFrame();
  const strings: string[] = [frame.hud.statusLine, frame.hud.selectedTeamName, frame.hud.projectName,
    frame.hud.missionShortLabel, frame.hud.currentWorkUnitShortId, frame.channy.animation];
  for (const entity of frame.semanticEntities) strings.push(entity.entityId, entity.label, entity.state);
  for (const actor of frame.actorFrames) {
    strings.push(actor.displayName);
    strings.push(...Object.values(actor.facts).map((value) => String(value)));
    if (actor.organizationFacts !== undefined) {
      for (const value of Object.values(actor.organizationFacts)) {
        if (typeof value === 'object' && value !== null && 'value' in value) strings.push(String((value as { value: unknown }).value));
      }
    }
  }
  return strings;
}

describe('BA-WU-05 living office scene-source content-safety (contract §5)', () => {
  it('renders no terminal/source/path/credential content anywhere in the office frame', () => {
    for (const rendered of collectRenderedStrings()) {
      for (const pattern of FORBIDDEN_CONTENT) {
        expect(pattern.test(rendered), `${pattern} matched ${JSON.stringify(rendered)}`).toBe(false);
      }
    }
  });

  it('keeps the committed registry + evidence fixture free of raw locators and credentials', async () => {
    const fixture = await readFile(path.join(REPOSITORY_ROOT, 'fixtures/organization-registry.ts'), 'utf8');
    const config = await readFile(path.join(REPOSITORY_ROOT, 'src/application/organization/office-layout-config.ts'), 'utf8');
    // The sha256/UUID formats used for evidence identity are references, not credentials — assert the
    // committed *data values* carry no absolute path, private key, or credential word.
    for (const source of [fixture, config]) {
      expect(source).not.toMatch(/\/home\/|\/Users\/|[A-Za-z]:\\/u);
      expect(source).not.toMatch(/BEGIN (?:RSA |EC )?PRIVATE KEY|\bpassword\b|\bapi[_-]?key\b/iu);
    }
  });

  it('keeps facility / actor / Channy surfaces symbolic (pure Pixi draws, no source/terminal text)', async () => {
    for (const relative of [
      'src/ui/pixel/facility-sprites.tsx',
      'src/ui/pixel/actor-sprite.tsx',
      'src/ui/pixel/channy-sprite.tsx',
    ]) {
      const source = await readFile(path.join(REPOSITORY_ROOT, relative), 'utf8');
      // Symbolic draw modules take a graphics port; they never read runtime terminal/source content.
      expect(source, relative).not.toMatch(/terminalOutput|stderr|stdout|child_process|readFile|process\.env/u);
      expect(source, relative).toContain('PixelGraphicsPort');
    }
  });
});
