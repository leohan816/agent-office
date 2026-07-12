import {
  buildIndexedPixelAtlas,
  type BuiltPixelAtlas,
  type IndexedPixelAtlasSource,
} from './atlas-builder.js';
import {
  ACTOR_ANIMATION_SOURCE_SPECS,
  ACTOR_BASE_ATLAS_SOURCE,
} from './actor-base-atlas.source.js';
import { ACTOR_IDENTITY_ATLAS_SOURCE } from './actor-identity-atlas.source.js';
import {
  CHANNY_ANIMATION_SOURCE_SPECS,
  CHANNY_ATLAS_SOURCE,
} from './channy-atlas.source.js';
import { OFFICE_WORLD_ATLAS_SOURCE } from './office-world-atlas.source.js';

export interface PixelAnimationManifestEntry {
  readonly animationId: string;
  readonly frameIds: readonly string[];
  readonly durationMs: number;
}

export interface PixelAtlasManifestV1 {
  readonly schemaVersion: 'agent-office.pixel-atlas.v1';
  readonly atlasId: string;
  readonly catalogVersion: '1';
  readonly status: 'PROTOTYPE_ORIGINAL';
  readonly sourceKind: 'CODE_NATIVE_INDEXED_PIXEL_MATRIX';
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  readonly logicalPixelScale: 1;
  readonly paletteId: 'agent-office.warm-retro.v1';
  readonly frameIds: readonly string[];
  readonly animations: readonly PixelAnimationManifestEntry[];
  readonly sourcePaths: readonly string[];
  readonly generatorPath: 'src/ui/pixel/assets/atlas-builder.ts';
  readonly generatorVersion: '1';
  readonly sourceOwner: 'Agent Office project';
  readonly sourceOrigin: 'ORIGINAL_PROJECT_AUTHORED';
  readonly licenseId: 'AGENT_OFFICE_INTERNAL_ORIGINAL_V1';
  readonly licenseTextPath: 'src/ui/pixel/assets/ASSET_INVENTORY.md';
  readonly attribution: 'Original code-native prototype artwork by Agent Office project';
  readonly sourceSha256: string;
  readonly generatedRgbaSha256: string;
  readonly containsScript: false;
  readonly containsExternalReference: false;
  readonly containsEmbeddedFont: false;
  readonly reviewedCommit: '9611d0da1479ca5e7a9677641fe767a6b39b4a38';
}

export interface PixelAtlasBundle {
  readonly manifest: PixelAtlasManifestV1;
  readonly built: BuiltPixelAtlas;
}

const sources = [
  OFFICE_WORLD_ATLAS_SOURCE,
  ACTOR_BASE_ATLAS_SOURCE,
  ACTOR_IDENTITY_ATLAS_SOURCE,
  CHANNY_ATLAS_SOURCE,
] as const;

export const PIXEL_ATLAS_BUNDLES: readonly PixelAtlasBundle[] = sources.map((source) => {
  const built = buildIndexedPixelAtlas(source);
  return {
    built,
    manifest: createManifest(source, built),
  };
});

export const PIXEL_ATLAS_MANIFESTS: readonly PixelAtlasManifestV1[] =
  PIXEL_ATLAS_BUNDLES.map((bundle) => bundle.manifest);

export function requirePixelAtlas(atlasId: string): PixelAtlasBundle {
  const bundle = PIXEL_ATLAS_BUNDLES.find((candidate) => candidate.manifest.atlasId === atlasId);
  if (bundle === undefined) throw new TypeError(`unknown pixel atlas: ${atlasId}`);
  return bundle;
}

export function totalGeneratedRgbaBytes(): number {
  return PIXEL_ATLAS_BUNDLES.reduce((total, bundle) => total + bundle.built.rgba.byteLength, 0);
}

function createManifest(
  source: IndexedPixelAtlasSource,
  built: BuiltPixelAtlas,
): PixelAtlasManifestV1 {
  return {
    schemaVersion: 'agent-office.pixel-atlas.v1',
    atlasId: source.atlasId,
    catalogVersion: '1',
    status: 'PROTOTYPE_ORIGINAL',
    sourceKind: 'CODE_NATIVE_INDEXED_PIXEL_MATRIX',
    intrinsicWidth: built.width,
    intrinsicHeight: built.height,
    logicalPixelScale: 1,
    paletteId: 'agent-office.warm-retro.v1',
    frameIds: built.frames.map((frame) => frame.frameId),
    animations: animationManifest(source),
    sourcePaths: [sourcePath(source.atlasId)],
    generatorPath: 'src/ui/pixel/assets/atlas-builder.ts',
    generatorVersion: '1',
    sourceOwner: 'Agent Office project',
    sourceOrigin: 'ORIGINAL_PROJECT_AUTHORED',
    licenseId: 'AGENT_OFFICE_INTERNAL_ORIGINAL_V1',
    licenseTextPath: 'src/ui/pixel/assets/ASSET_INVENTORY.md',
    attribution: 'Original code-native prototype artwork by Agent Office project',
    sourceSha256: built.sourceSha256,
    generatedRgbaSha256: built.generatedRgbaSha256,
    containsScript: false,
    containsExternalReference: false,
    containsEmbeddedFont: false,
    reviewedCommit: '9611d0da1479ca5e7a9677641fe767a6b39b4a38',
  };
}

function animationManifest(source: IndexedPixelAtlasSource): readonly PixelAnimationManifestEntry[] {
  if (source.atlasId === 'actor-base.v1') {
    return ACTOR_ANIMATION_SOURCE_SPECS.map((animation) => ({
      animationId: animation.animationId,
      frameIds: Array.from(
        { length: animation.frameCount },
        (_, index) => `${animation.animationId}.${index}`,
      ),
      durationMs: animation.durationMs,
    }));
  }
  if (source.atlasId === 'channy.v1') {
    return CHANNY_ANIMATION_SOURCE_SPECS.map((animation) => ({
      animationId: animation.animationId,
      frameIds: Array.from(
        { length: animation.frameCount },
        (_, index) => `${animation.animationId}.${index}`,
      ),
      durationMs: animation.durationMs,
    }));
  }
  return [];
}

function sourcePath(atlasId: string): string {
  const paths: Readonly<Record<string, string>> = {
    'office-world.v1': 'src/ui/pixel/assets/office-world-atlas.source.ts',
    'actor-base.v1': 'src/ui/pixel/assets/actor-base-atlas.source.ts',
    'actor-identity.v1': 'src/ui/pixel/assets/actor-identity-atlas.source.ts',
    'channy.v1': 'src/ui/pixel/assets/channy-atlas.source.ts',
  };
  const path = paths[atlasId];
  if (path === undefined) throw new TypeError(`unregistered atlas source: ${atlasId}`);
  return path;
}
