export const SPATIAL_ASSET_SCHEMA_VERSION = 'agent-office.character-assets.v1' as const;

export const SPATIAL_PLACEHOLDER_SOURCE = {
  sourcePath: 'src/ui/spatial/assets/placeholder-characters.tsx',
  sourceOwner: 'Agent Office project-authored',
  sourceOrigin: 'Original code-native AO12-B placeholder implementation',
  licenseId: 'AGENT-OFFICE-INTERNAL-PLACEHOLDER-1.0',
  licenseTextPath: 'src/ui/spatial/assets/ASSET_INVENTORY.md',
  sourceSha256: 'adacf982a568bffefe1a6eddefb58584ff706f9408fdf5ab81a42ce49b19bd63',
} as const;

export type SpatialAssetStatus = 'PLACEHOLDER' | 'PRODUCTION_APPROVED' | 'RETIRED';

export interface SpatialAssetManifestEntry {
  readonly schemaVersion: typeof SPATIAL_ASSET_SCHEMA_VERSION;
  readonly assetId: string;
  readonly semanticRole: string;
  readonly status: SpatialAssetStatus;
  readonly format: 'TSX_INLINE_SVG';
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  readonly viewBox: string;
  readonly variants: readonly string[];
  readonly sourcePath: string;
  readonly sourceOwner: string;
  readonly sourceOrigin: string;
  readonly licenseId: string;
  readonly licenseTextPath: string;
  readonly attribution: string;
  readonly acquiredAt: null;
  readonly purchaseEvidenceRef: null;
  readonly sourceSha256: string;
  readonly optimizedSha256: string;
  readonly containsScript: false;
  readonly containsExternalReference: false;
  readonly replacementFor: null;
  readonly reviewedCommit: null;
}

function placeholder(
  assetId: string,
  semanticRole: string,
  intrinsicWidth: number,
  intrinsicHeight: number,
  variants: readonly string[],
): SpatialAssetManifestEntry {
  return {
    schemaVersion: SPATIAL_ASSET_SCHEMA_VERSION,
    assetId,
    semanticRole,
    status: 'PLACEHOLDER',
    format: 'TSX_INLINE_SVG',
    intrinsicWidth,
    intrinsicHeight,
    viewBox: `0 0 ${intrinsicWidth} ${intrinsicHeight}`,
    variants,
    ...SPATIAL_PLACEHOLDER_SOURCE,
    attribution: 'Created in-repository for Agent Office AO12-B; no third-party material.',
    acquiredAt: null,
    purchaseEvidenceRef: null,
    optimizedSha256: SPATIAL_PLACEHOLDER_SOURCE.sourceSha256,
    containsScript: false,
    containsExternalReference: false,
    replacementFor: null,
    reviewedCommit: null,
  };
}

export const SPATIAL_ASSET_REGISTRY = [
  placeholder('ao12.character-full.v1', 'character-full', 96, 96, [
    'LEO_DECISION',
    'ADVISOR_ROUTING',
    'CONTROL_RECOVERY',
    'INDEPENDENT_REVIEW',
    'WORKER_BUILD',
    'GENERIC_REGISTERED',
  ]),
  placeholder('ao12.character-route.v1', 'character-route', 48, 48, ['STATIC_PLACEHOLDER_ONLY']),
  placeholder('ao12.role-glyph.v1', 'role-glyph', 24, 24, [
    'LEO_DECISION',
    'ADVISOR_ROUTING',
    'CONTROL_RECOVERY',
    'INDEPENDENT_REVIEW',
    'WORKER_BUILD',
    'GENERIC_REGISTERED',
  ]),
  placeholder('ao12.project-glyph.v1', 'project-glyph', 24, 24, ['GEOMETRIC_TEXT_FALLBACK']),
  placeholder('ao12.assignment-badge.v1', 'assignment-badge', 48, 20, ['PROJECT_TEXT_PATTERN']),
  placeholder('ao12.channy-full.v1', 'channy-full', 72, 72, ['NEUTRAL_STATIC_BEDLINGTON_TERRIER']),
  placeholder('ao12.channy-facility.v1', 'channy-facility', 120, 64, ['BED', 'FOOD_BOWL', 'WATER_BOWL']),
  placeholder('ao12.office-facilities.v1', 'office-facilities', 120, 64, [
    'WOOD_DESK',
    'GLASS_MEETING_ROOM',
    'COFFEE_LOUNGE',
    'SHARED_PATH',
    'PROJECT_SIGN',
    'MISSION_BOARD',
    'REVIEWER_BOOTH',
    'ADVISOR_HUB',
  ]),
] as const satisfies readonly SpatialAssetManifestEntry[];

export const NEUTRAL_SPATIAL_ASSET_ID = 'ao12.character-full.v1' as const;

export function resolveSpatialAsset(assetId: string | null | undefined): SpatialAssetManifestEntry {
  return SPATIAL_ASSET_REGISTRY.find((entry) => entry.assetId === assetId)
    ?? requireNeutralAsset();
}

function requireNeutralAsset(): SpatialAssetManifestEntry {
  const asset = SPATIAL_ASSET_REGISTRY.find((entry) => entry.assetId === NEUTRAL_SPATIAL_ASSET_ID);
  if (asset === undefined) throw new TypeError('neutral spatial placeholder is missing');
  return asset;
}
