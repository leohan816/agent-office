export const PROJECT_IDENTITY_CATALOG_VERSION = 'agent-office.project-identity.v1' as const;

export const PROJECT_PATTERNS = [
  'solid',
  'diagonal',
  'crosshatch',
  'dots',
  'horizontal',
  'stepped',
] as const;

export const PROJECT_GLYPHS = [
  'circle',
  'diamond',
  'triangle',
  'hexagon',
  'square',
  'star',
  'cross',
  'wave',
] as const;

export const PROJECT_EDGE_STYLES = ['solid', 'double', 'dashed', 'dot-dash'] as const;

export type ProjectPattern = (typeof PROJECT_PATTERNS)[number];
export type ProjectGlyph = (typeof PROJECT_GLYPHS)[number];
export type ProjectEdgeStyle = (typeof PROJECT_EDGE_STYLES)[number];

export interface ProjectPalette {
  readonly paletteId: string;
  readonly family: string;
  readonly accent: `#${string}`;
  readonly darkSurface: `#${string}`;
  readonly darkText: `#${string}`;
  readonly lightSurface: `#${string}`;
  readonly lightText: `#${string}`;
  readonly monochromeSurface: `#${string}`;
  readonly monochromeText: `#${string}`;
}

export interface ProjectIdentitySlots {
  readonly hueSlot: number;
  readonly patternSlot: number;
  readonly glyphSlot: number;
  readonly edgeSlot: number;
}

export interface ProjectIdentity {
  readonly schemaVersion: typeof PROJECT_IDENTITY_CATALOG_VERSION;
  readonly catalogEntryId: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly shortLabel: string;
  readonly condensedLabel: string;
  readonly collisionMarker: string;
  readonly collisionNote: 'PROJECT_IDENTITY_COLLISION' | null;
  readonly fixed: boolean;
  readonly palette: ProjectPalette;
  readonly pattern: ProjectPattern;
  readonly glyph: ProjectGlyph;
  readonly edge: ProjectEdgeStyle;
  readonly fallbackSlots: ProjectIdentitySlots | null;
}

interface FixedIdentityEntry {
  readonly catalogEntryId: string;
  readonly displayName: string;
  readonly palette: ProjectPalette;
  readonly pattern: ProjectPattern;
  readonly glyph: ProjectGlyph;
  readonly edge: ProjectEdgeStyle;
}

const palette = (
  paletteId: string,
  family: string,
  accent: `#${string}`,
  darkSurface: `#${string}`,
  darkText: `#${string}`,
  lightSurface: `#${string}`,
  lightText: `#${string}`,
): ProjectPalette => ({
  paletteId,
  family,
  accent,
  darkSurface,
  darkText,
  lightSurface,
  lightText,
  monochromeSurface: '#2c3138',
  monochromeText: '#ffffff',
});

export const FIXED_PROJECT_PALETTES = {
  cosmile: palette('cosmile-coral-pink', 'coral/pink', '#ff8b9d', '#4a1826', '#fff5f6', '#ffe2e7', '#4a1020'),
  siasiu: palette('siasiu-mint-emerald', 'mint/emerald', '#5ad9aa', '#103c31', '#ecfff8', '#d8f8ec', '#123c31'),
  foundation: palette('foundation-navy-blue', 'navy/blue', '#79adff', '#182f55', '#f2f7ff', '#dfeaff', '#17345f'),
  vibenews: palette('vibenews-purple', 'purple', '#c49aff', '#3b2457', '#fbf5ff', '#eee0ff', '#3d235d'),
  'agent-office': palette('agent-office-orange-amber', 'orange/amber', '#ffb45f', '#4a2b10', '#fff8ee', '#ffead2', '#4a2a0c'),
  control: palette('control-slate-blue', 'slate/charcoal with blue accent', '#83b6ff', '#27343f', '#f4f8fb', '#e2e9ef', '#24323d'),
} as const satisfies Readonly<Record<string, ProjectPalette>>;

const FIXED_PROJECT_IDENTITIES: Readonly<Record<string, FixedIdentityEntry>> = {
  cosmile: {
    catalogEntryId: 'fixed.cosmile',
    displayName: 'Cosmile',
    palette: FIXED_PROJECT_PALETTES.cosmile,
    pattern: 'diagonal',
    glyph: 'circle',
    edge: 'solid',
  },
  siasiu: {
    catalogEntryId: 'fixed.siasiu',
    displayName: 'SIASIU',
    palette: FIXED_PROJECT_PALETTES.siasiu,
    pattern: 'crosshatch',
    glyph: 'diamond',
    edge: 'double',
  },
  foundation: {
    catalogEntryId: 'fixed.foundation',
    displayName: 'Foundation',
    palette: FIXED_PROJECT_PALETTES.foundation,
    pattern: 'horizontal',
    glyph: 'hexagon',
    edge: 'dashed',
  },
  vibenews: {
    catalogEntryId: 'fixed.vibenews',
    displayName: 'VibeNews',
    palette: FIXED_PROJECT_PALETTES.vibenews,
    pattern: 'dots',
    glyph: 'triangle',
    edge: 'dot-dash',
  },
  'agent-office': {
    catalogEntryId: 'fixed.agent-office',
    displayName: 'Agent Office',
    palette: FIXED_PROJECT_PALETTES['agent-office'],
    pattern: 'stepped',
    glyph: 'square',
    edge: 'double',
  },
  control: {
    catalogEntryId: 'fixed.control',
    displayName: 'Control',
    palette: FIXED_PROJECT_PALETTES.control,
    pattern: 'solid',
    glyph: 'cross',
    edge: 'dashed',
  },
};

export const FALLBACK_PROJECT_PALETTES = [
  palette('fallback-ocean', 'ocean blue', '#71b8ff', '#173657', '#f3f9ff', '#dbeeff', '#173855'),
  palette('fallback-teal', 'teal', '#54d4cd', '#123d3e', '#efffff', '#d6f7f5', '#123f3e'),
  palette('fallback-violet', 'violet', '#b99cff', '#38285a', '#faf7ff', '#e9e0ff', '#38265c'),
  palette('fallback-rose', 'rose', '#f39ab8', '#4a2031', '#fff6fa', '#fde0ea', '#4b2030'),
  palette('fallback-cyan', 'cyan', '#6ed2ea', '#123b49', '#f2fcff', '#d9f5fb', '#123d49'),
  palette('fallback-indigo', 'indigo', '#9caeff', '#26345f', '#f5f7ff', '#e3e8ff', '#26345f'),
  palette('fallback-plum', 'plum', '#d58ed8', '#47264a', '#fff5ff', '#f5ddf6', '#47254a'),
  palette('fallback-seafoam', 'seafoam', '#72d7b2', '#173e34', '#f1fff9', '#daf7eb', '#173f34'),
] as const satisfies readonly ProjectPalette[];

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

const SHA256_ROUND = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

export function resolveProjectIdentity(projectId: string, displayName: string): ProjectIdentity {
  const normalizedId = projectId.normalize('NFC');
  if (normalizedId.trim().length === 0) throw new TypeError('projectId must not be empty');
  const digest = sha256Utf8(normalizedId);
  const collisionMarker = bytesToHex(digest.subarray(0, 4));
  const fixed = FIXED_PROJECT_IDENTITIES[normalizedId.toLocaleLowerCase('en-US')];
  const suppliedDisplayName = displayName.normalize('NFC').trim();
  const exactDisplayName = fixed?.displayName ?? (suppliedDisplayName || normalizedId);
  const shortLabel = deriveProjectShortLabel(exactDisplayName, normalizedId);
  if (fixed !== undefined) {
    return {
      schemaVersion: PROJECT_IDENTITY_CATALOG_VERSION,
      catalogEntryId: fixed.catalogEntryId,
      projectId: normalizedId,
      displayName: exactDisplayName,
      shortLabel,
      condensedLabel: shortLabel,
      collisionMarker,
      collisionNote: null,
      fixed: true,
      palette: fixed.palette,
      pattern: fixed.pattern,
      glyph: fixed.glyph,
      edge: fixed.edge,
      fallbackSlots: null,
    };
  }
  const slots: ProjectIdentitySlots = {
    hueSlot: requireByte(digest, 0) % FALLBACK_PROJECT_PALETTES.length,
    patternSlot: requireByte(digest, 1) % PROJECT_PATTERNS.length,
    glyphSlot: requireByte(digest, 2) % PROJECT_GLYPHS.length,
    edgeSlot: requireByte(digest, 3) % PROJECT_EDGE_STYLES.length,
  };
  const fallbackPalette = FALLBACK_PROJECT_PALETTES[slots.hueSlot];
  const pattern = PROJECT_PATTERNS[slots.patternSlot];
  const glyph = PROJECT_GLYPHS[slots.glyphSlot];
  const edge = PROJECT_EDGE_STYLES[slots.edgeSlot];
  if (fallbackPalette === undefined || pattern === undefined || glyph === undefined || edge === undefined) {
    throw new TypeError('project identity catalog slot is invalid');
  }
  return {
    schemaVersion: PROJECT_IDENTITY_CATALOG_VERSION,
    catalogEntryId: `fallback.${slots.hueSlot}.${slots.patternSlot}.${slots.glyphSlot}.${slots.edgeSlot}`,
    projectId: normalizedId,
    displayName: exactDisplayName,
    shortLabel,
    condensedLabel: shortLabel,
    collisionMarker,
    collisionNote: null,
    fixed: false,
    palette: fallbackPalette,
    pattern,
    glyph,
    edge,
    fallbackSlots: slots,
  };
}

export function resolveVisibleProjectIdentities(
  projects: readonly { readonly projectId: string; readonly displayName: string }[],
): readonly ProjectIdentity[] {
  const identities = projects.map((project) => resolveProjectIdentity(project.projectId, project.displayName));
  const labelCounts = countBy(identities, (identity) => identity.shortLabel);
  const tupleCounts = countBy(identities, identityTuple);
  return identities.map((identity) => {
    const collision = (labelCounts.get(identity.shortLabel) ?? 0) > 1
      || (tupleCounts.get(identityTuple(identity)) ?? 0) > 1;
    return collision
      ? {
          ...identity,
          condensedLabel: `${identity.shortLabel}-${identity.collisionMarker}`,
          collisionNote: 'PROJECT_IDENTITY_COLLISION',
        }
      : identity;
  });
}

export function deriveProjectShortLabel(displayName: string, projectId: string): string {
  const words = displayName.normalize('NFC').trim().split(/\s+/u).filter(Boolean).slice(0, 2);
  if (words.length >= 2) {
    return words.map((word) => graphemes(word, 1)).join('');
  }
  const source = words[0] ?? projectId.normalize('NFC');
  return graphemes(source, 2);
}

export function sha256HexUtf8(value: string): string {
  return bytesToHex(sha256Utf8(value));
}

export function contrastRatio(foreground: `#${string}`, background: `#${string}`): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function sha256Utf8(value: string): Uint8Array {
  const input = new TextEncoder().encode(value);
  const bitLength = BigInt(input.length) * 8n;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setBigUint64(paddedLength - 8, bitLength, false);
  const hash = Uint32Array.from(SHA256_INITIAL);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = requireWord(words, index - 15);
      const right = requireWord(words, index - 2);
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (requireWord(words, index - 16) + sigma0 + requireWord(words, index - 7) + sigma1) >>> 0;
    }
    let a = requireWord(hash, 0);
    let b = requireWord(hash, 1);
    let c = requireWord(hash, 2);
    let d = requireWord(hash, 3);
    let e = requireWord(hash, 4);
    let f = requireWord(hash, 5);
    let g = requireWord(hash, 6);
    let h = requireWord(hash, 7);
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + requireWord(SHA256_ROUND, index) + requireWord(words, index)) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (requireWord(hash, 0) + a) >>> 0;
    hash[1] = (requireWord(hash, 1) + b) >>> 0;
    hash[2] = (requireWord(hash, 2) + c) >>> 0;
    hash[3] = (requireWord(hash, 3) + d) >>> 0;
    hash[4] = (requireWord(hash, 4) + e) >>> 0;
    hash[5] = (requireWord(hash, 5) + f) >>> 0;
    hash[6] = (requireWord(hash, 6) + g) >>> 0;
    hash[7] = (requireWord(hash, 7) + h) >>> 0;
  }
  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  hash.forEach((word, index) => outputView.setUint32(index * 4, word, false));
  return output;
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function requireWord(source: ArrayLike<number>, index: number): number {
  const value = source[index];
  if (value === undefined) throw new TypeError('SHA-256 word is missing');
  return value;
}

function requireByte(source: Uint8Array, index: number): number {
  const value = source[index];
  if (value === undefined) throw new TypeError('SHA-256 byte is missing');
  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function graphemes(value: string, limit: number): string {
  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
  return [...segmenter.segment(value)].slice(0, limit).map((segment) => segment.segment).join('');
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function identityTuple(identity: ProjectIdentity): string {
  return [identity.palette.paletteId, identity.pattern, identity.glyph, identity.edge].join('|');
}

function relativeLuminance(color: `#${string}`): number {
  if (!/^#[0-9a-f]{6}$/iu.test(color)) throw new TypeError(`unsupported color ${color}`);
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
