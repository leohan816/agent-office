import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  NEUTRAL_SPATIAL_ASSET_ID,
  SPATIAL_ASSET_REGISTRY,
  SPATIAL_ASSET_SCHEMA_VERSION,
  SPATIAL_PLACEHOLDER_SOURCE,
  resolveSpatialAsset,
} from '../../src/ui/spatial/asset-registry.js';
import {
  ActorPlaceholder,
  ChannyPlaceholder,
  FacilityPlaceholder,
  SPATIAL_FACILITY_KINDS,
  SPATIAL_ROLE_CATEGORIES,
} from '../../src/ui/spatial/assets/placeholder-characters.js';

describe('AO12-B project-authored placeholder contract', () => {
  it('records and mechanically verifies actual source SHA-256, owner, origin, and internal license', async () => {
    const source = await readFile(path.resolve(import.meta.dirname, '../../src/ui/spatial/assets/placeholder-characters.tsx'));
    expect(createHash('sha256').update(source).digest('hex')).toBe(SPATIAL_PLACEHOLDER_SOURCE.sourceSha256);
    expect(SPATIAL_PLACEHOLDER_SOURCE).toMatchObject({
      sourceOwner: 'Agent Office project-authored',
      sourceOrigin: 'Original code-native AO12-B placeholder implementation',
      licenseId: 'AGENT-OFFICE-INTERNAL-PLACEHOLDER-1.0',
      licenseTextPath: 'src/ui/spatial/assets/ASSET_INVENTORY.md',
    });
    const inventory = await readFile(path.resolve(import.meta.dirname, '../../src/ui/spatial/assets/ASSET_INVENTORY.md'), 'utf8');
    expect(inventory).toContain(SPATIAL_PLACEHOLDER_SOURCE.sourceSha256);
    expect(inventory).toContain('third-party material');
    expect(inventory).toContain('not approved production art');
  });

  it('pins every required manifest field and stable intrinsic slot', () => {
    expect(SPATIAL_ASSET_REGISTRY.map((entry) => [entry.semanticRole, entry.intrinsicWidth, entry.intrinsicHeight, entry.viewBox])).toEqual([
      ['character-full', 96, 96, '0 0 96 96'],
      ['character-route', 48, 48, '0 0 48 48'],
      ['role-glyph', 24, 24, '0 0 24 24'],
      ['project-glyph', 24, 24, '0 0 24 24'],
      ['assignment-badge', 48, 20, '0 0 48 20'],
      ['channy-full', 72, 72, '0 0 72 72'],
      ['channy-facility', 120, 64, '0 0 120 64'],
      ['office-facilities', 120, 64, '0 0 120 64'],
    ]);
    for (const entry of SPATIAL_ASSET_REGISTRY) {
      expect(entry).toMatchObject({
        schemaVersion: SPATIAL_ASSET_SCHEMA_VERSION,
        status: 'PLACEHOLDER',
        format: 'TSX_INLINE_SVG',
        sourcePath: SPATIAL_PLACEHOLDER_SOURCE.sourcePath,
        sourceOwner: SPATIAL_PLACEHOLDER_SOURCE.sourceOwner,
        sourceOrigin: SPATIAL_PLACEHOLDER_SOURCE.sourceOrigin,
        licenseId: SPATIAL_PLACEHOLDER_SOURCE.licenseId,
        licenseTextPath: SPATIAL_PLACEHOLDER_SOURCE.licenseTextPath,
        acquiredAt: null,
        purchaseEvidenceRef: null,
        sourceSha256: SPATIAL_PLACEHOLDER_SOURCE.sourceSha256,
        optimizedSha256: SPATIAL_PLACEHOLDER_SOURCE.sourceSha256,
        containsScript: false,
        containsExternalReference: false,
        replacementFor: null,
        reviewedCommit: null,
      });
      expect(entry.attribution).toContain('no third-party material');
    }
  });

  it('keeps semantic role/project layers separate and uses a stable neutral fallback', () => {
    expect(SPATIAL_ROLE_CATEGORIES).toEqual([
      'LEO_DECISION',
      'ADVISOR_ROUTING',
      'CONTROL_RECOVERY',
      'INDEPENDENT_REVIEW',
      'WORKER_BUILD',
      'GENERIC_REGISTERED',
    ]);
    expect(resolveSpatialAsset('missing').assetId).toBe(NEUTRAL_SPATIAL_ASSET_ID);
    const markup = renderToStaticMarkup(createElement(ActorPlaceholder, {
      accent: '#ffb45f',
      roleCategory: 'WORKER_BUILD',
    }));
    expect(markup).toContain('viewBox="0 0 96 96"');
    expect(markup).not.toContain('Agent Office');
  });

  it('renders one neutral Channy and all static facilities without operational semantics', () => {
    const channy = renderToStaticMarkup(createElement(ChannyPlaceholder));
    expect(channy).toContain('viewBox="0 0 72 72"');
    for (const prohibited of ['roleInstanceId', 'authority', 'assignment', 'notification', 'terminal', 'command', 'approval', 'repair']) {
      expect(channy.toLocaleLowerCase('en-US')).not.toContain(prohibited.toLocaleLowerCase('en-US'));
    }
    expect(SPATIAL_FACILITY_KINDS).toContain('CHANNY_FACILITIES');
    const facilities = SPATIAL_FACILITY_KINDS
      .map((kind) => renderToStaticMarkup(createElement(FacilityPlaceholder, { kind })))
      .join('\n');
    expect(facilities.match(/viewBox="0 0 120 64"/gu)).toHaveLength(SPATIAL_FACILITY_KINDS.length);
  });

  it('contains no external, executable, generated, fetched, or user-supplied asset surface', async () => {
    const source = await readFile(path.resolve(import.meta.dirname, '../../src/ui/spatial/assets/placeholder-characters.tsx'), 'utf8');
    expect(source).not.toMatch(/https?:\/\/|fetch\s*\(|<script|dangerouslySetInnerHTML|foreignObject|\bhref=|\bdata:|Audio\s*\(|Video\s*\(|WebGL|canvas/iu);
    expect(source).not.toMatch(/on(?:Click|Load|Error|Mouse|Key|Pointer|Touch)\s*=/u);
  });
});
