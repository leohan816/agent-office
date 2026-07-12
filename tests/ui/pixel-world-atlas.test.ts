import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  PIXEL_ATLAS_BUNDLES,
  PIXEL_ATLAS_MANIFESTS,
  requirePixelAtlas,
  totalGeneratedRgbaBytes,
} from '../../src/ui/pixel/assets/atlas-manifest.js';
import { sha256Hex } from '../../src/ui/pixel/assets/atlas-builder.js';
import { LIVING_OFFICE_PALETTE, PROJECT_PIXEL_COLORS } from '../../src/ui/pixel/assets/palette.js';

describe('original code-native living-office atlas contract', () => {
  it('builds exactly four bounded deterministic texture sources with SHA-256 truth', () => {
    expect(PIXEL_ATLAS_BUNDLES).toHaveLength(4);
    expect(PIXEL_ATLAS_MANIFESTS.map((manifest) => manifest.atlasId)).toEqual([
      'office-world.v1', 'actor-base.v1', 'actor-identity.v1', 'channy.v1',
    ]);
    for (const { manifest, built } of PIXEL_ATLAS_BUNDLES) {
      expect(manifest.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(manifest.generatedRgbaSha256).toBe(sha256Hex(built.rgba));
      expect(manifest.generatedRgbaSha256).toBe(
        createHash('sha256').update(built.rgba).digest('hex'),
      );
      expect(built.rgba.byteLength).toBe(built.width * built.height * 4);
      expect(manifest.containsExternalReference).toBe(false);
      expect(manifest.containsEmbeddedFont).toBe(false);
      expect(manifest.containsScript).toBe(false);
      expect(manifest.sourceOrigin).toBe('ORIGINAL_PROJECT_AUTHORED');
      expect(manifest.licenseId).toBe('AGENT_OFFICE_INTERNAL_ORIGINAL_V1');
    }
    expect(requirePixelAtlas('office-world.v1').built.width).toBeLessThanOrEqual(1024);
    expect(requirePixelAtlas('actor-base.v1').built.width).toBeLessThanOrEqual(512);
    expect(requirePixelAtlas('actor-base.v1').built.height).toBeLessThanOrEqual(1024);
    expect(requirePixelAtlas('actor-identity.v1').built.width).toBeLessThanOrEqual(512);
    expect(requirePixelAtlas('channy.v1').built.width).toBeLessThanOrEqual(512);
    expect(requirePixelAtlas('channy.v1').built.height).toBeLessThanOrEqual(512);
    expect(totalGeneratedRgbaBytes()).toBeLessThanOrEqual(32 * 1024 * 1024);
    console.info(`PIXEL_ATLAS_HASHES ${JSON.stringify(PIXEL_ATLAS_MANIFESTS.map((manifest) => ({
      atlasId: manifest.atlasId,
      sourceSha256: manifest.sourceSha256,
      generatedRgbaSha256: manifest.generatedRgbaSha256,
    })))}`);
    const rgba = Buffer.concat(PIXEL_ATLAS_BUNDLES.map((bundle) => Buffer.from(bundle.built.rgba)));
    expect(gzipSync(rgba, { level: 9 }).byteLength).toBeLessThanOrEqual(256 * 1024);
  });

  it('packs non-overlapping in-bounds frames with valid feet and collision geometry', () => {
    for (const { built } of PIXEL_ATLAS_BUNDLES) {
      for (const [index, frame] of built.frames.entries()) {
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(built.width);
        expect(frame.y + frame.height).toBeLessThanOrEqual(built.height);
        expect(Number.isInteger(frame.anchorFootX)).toBe(true);
        expect(Number.isInteger(frame.anchorFootY)).toBe(true);
        for (const other of built.frames.slice(0, index)) {
          const overlaps = frame.x < other.x + other.width
            && frame.x + frame.width > other.x
            && frame.y < other.y + other.height
            && frame.y + frame.height > other.y;
          expect(overlaps, `${built.atlasId}/${frame.frameId}/${other.frameId}`).toBe(false);
        }
      }
    }
  });

  it('contains every required actor and Channy animation with minimum frames', () => {
    const actor = requirePixelAtlas('actor-base.v1').manifest;
    const channy = requirePixelAtlas('channy.v1').manifest;
    for (const [prefix, minimum] of [
      ['actor.idle', 4], ['actor.walk', 6], ['actor.sit', 2], ['actor.type', 4],
      ['actor.review', 4], ['actor.carry-document', 6], ['actor.return-result', 6],
      ['actor.coffee', 4], ['actor.rest', 2], ['actor.lounge', 4],
    ] as const) {
      const matches = actor.animations.filter((animation) => animation.animationId.startsWith(prefix));
      expect(matches).toHaveLength(4);
      expect(matches.every((animation) => animation.frameIds.length >= minimum)).toBe(true);
    }
    for (const [animationId, minimum] of [
      ['channy.walk', 6], ['channy.stop', 1], ['channy.sniff', 3],
      ['channy.roam', 6], ['channy.sit', 3], ['channy.eat', 4], ['channy.drink', 4],
      ['channy.sleep', 4], ['channy.play', 6], ['channy.react-waiting-leo', 3],
      ['channy.react-blocked', 3], ['channy.react-complete', 4],
      ['channy.react-stale-offline', 1],
    ] as const) {
      const matches = channy.animations.filter((animation) => animation.animationId.startsWith(animationId));
      expect(matches.length, animationId).toBeGreaterThan(0);
      expect(matches.every((animation) => animation.frameIds.length >= minimum)).toBe(true);
    }
  });

  it('uses the reviewed modern light-office palette with project colors as accents', () => {
    expect(LIVING_OFFICE_PALETTE.wall).toEqual([247, 244, 236, 255]);
    expect(LIVING_OFFICE_PALETTE.floor).toEqual([215, 188, 151, 255]);
    expect(LIVING_OFFICE_PALETTE.floorLight).toEqual([235, 216, 187, 255]);
    expect(LIVING_OFFICE_PALETTE.glass).toEqual([157, 205, 220, 190]);
    expect(LIVING_OFFICE_PALETTE.ink).toEqual([55, 58, 61, 255]);
    expect(Object.keys(PROJECT_PIXEL_COLORS).sort()).toEqual([
      'agent-office', 'control', 'cosmile', 'foundation', 'siasiu', 'vibenews',
    ]);
  });

  it('documents ownership, replacement gates and no external/protected source', async () => {
    const inventory = await readFile(
      path.resolve(import.meta.dirname, '../../src/ui/pixel/assets/ASSET_INVENTORY.md'),
      'utf8',
    );
    expect(inventory).toContain('PROTOTYPE_ORIGINAL__SYNTHETIC_TEST_DEMO_ONLY__NOT_PRODUCTION_APPROVED');
    expect(inventory).toContain('AGENT_OFFICE_INTERNAL_ORIGINAL_V1');
    expect(inventory).toMatch(/no\s+external image, font, URL, download, model/u);
    expect(inventory).toContain('Replacement is separately gated');
    for (const manifest of PIXEL_ATLAS_MANIFESTS) {
      expect(inventory).toContain(manifest.atlasId);
      expect(inventory).toContain(manifest.sourceSha256);
      expect(inventory).toContain(manifest.generatedRgbaSha256);
    }
  });
});
