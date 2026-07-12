import type { IndexedPixelAtlasSource, IndexedPixelFrameSource } from './atlas-builder.js';
import { LIVING_OFFICE_PALETTE } from './palette.js';

const palette = {
  '.': LIVING_OFFICE_PALETTE.transparent,
  I: LIVING_OFFICE_PALETTE.ink,
  W: LIVING_OFFICE_PALETTE.wall,
  S: LIVING_OFFICE_PALETTE.wallShadow,
  F: LIVING_OFFICE_PALETTE.floor,
  L: LIVING_OFFICE_PALETTE.floorLight,
  G: LIVING_OFFICE_PALETTE.glass,
  M: LIVING_OFFICE_PALETTE.monitor,
  P: LIVING_OFFICE_PALETTE.plant,
  C: LIVING_OFFICE_PALETTE.cream,
} as const;

const tileSources: Readonly<Record<string, readonly string[]>> = {
  floor: [
    'FFFFFFFFFFFFFFFF', 'FLLLFFFFFLLLFFFF', 'FLLLFFFFFLLLFFFF', 'FLLLFFFFFLLLFFFF',
    'FFFFFFFFFFFFFFFF', 'FFFFFLLLFFFFFLLL', 'FFFFFLLLFFFFFLLL', 'FFFFFLLLFFFFFLLL',
    'FFFFFFFFFFFFFFFF', 'FLLLFFFFFLLLFFFF', 'FLLLFFFFFLLLFFFF', 'FLLLFFFFFLLLFFFF',
    'FFFFFFFFFFFFFFFF', 'FFFFFLLLFFFFFLLL', 'FFFFFLLLFFFFFLLL', 'FFFFFLLLFFFFFLLL',
  ],
  wall: [
    'IIIIIIIIIIIIIIII', 'IWWWWWWWWWWWWWWI', 'IWWWWWWWWWWWWWWI', 'IWWWWWWWWWWWWWWI',
    'IWWWWWWWWWWWWWWI', 'IWWWWWWWWWWWWWWI', 'IWWWWWWWWWWWWWWI', 'IWWWWWWWWWWWWWWI',
    'ISSSSSSSSSSSSSSI', 'ISSSSSSSSSSSSSSI', 'ISSSSSSSSSSSSSSI', 'ISSSSSSSSSSSSSSI',
    'ISSSSSSSSSSSSSSI', 'ISSSSSSSSSSSSSSI', 'ISSSSSSSSSSSSSSI', 'IIIIIIIIIIIIIIII',
  ],
  glass: [
    'IIIIIIIIIIIIIIII', 'IGGGGGGGGGGGGGGI', 'IGG..GGGG..GGGGI', 'IGG..GGGG..GGGGI',
    'IGGGGGGGGGGGGGGI', 'IGGGGGGGGGGGGGGI', 'IGGGGGGGGGGGGGGI', 'IGGGGGGGGGGGGGGI',
    'IGGGGGGGGGGGGGGI', 'IGGGGGGGGGGGGGGI', 'IGG..GGGG..GGGGI', 'IGG..GGGG..GGGGI',
    'IGGGGGGGGGGGGGGI', 'IGGGGGGGGGGGGGGI', 'IGGGGGGGGGGGGGGI', 'IIIIIIIIIIIIIIII',
  ],
  desk: [
    '................', '..IIIIIIIIIIII..', '..IWWWWWWWWWWI..', '..ISSSSSSSSSSI..',
    '..IIIIIIIIIIII..', '...II......II...', '...II......II...', '...II......II...',
    '...II......II...', '...II......II...', '...II......II...', '................',
    '................', '................', '................', '................',
  ],
  monitor: [
    '................', '....IIIIIIII....', '....IMMMMMMI....', '....IMMMMMMI....',
    '....IMMMMMMI....', '....IMMMMMMI....', '....IIIIIIII....', '.......II.......',
    '......IIII......', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  plant: [
    '.......P........', '.....P.P.P......', '......PPP.......', '....P.PPP.P.....',
    '.....PPPPP......', '.......P........', '.......P........', '......III.......',
    '.....IWWWI......', '.....IWWWI......', '......III.......', '................',
    '................', '................', '................', '................',
  ],
  board: [
    'IIIIIIIIIIIIIIII', 'ICCCCCCCCCCCCCCI', 'ICMMCCCCMMCCCCCI', 'ICMMCCCCMMCCCCCI',
    'ICCCCCCCCCCCCCCI', 'ICMMMMMMMMMMMMCI', 'ICCCCCCCCCCCCCCI', 'ICMMMMMMCCCCCCCI',
    'ICCCCCCCCCCCCCCI', 'ICMMMMMMMMMCCCCI', 'ICCCCCCCCCCCCCCI', 'ICCCCCCCCCCCCCCI',
    'ICCCCCCCCCCCCCCI', 'ICCCCCCCCCCCCCCI', 'ICCCCCCCCCCCCCCI', 'IIIIIIIIIIIIIIII',
  ],
  rug: [
    'SSSSSSSSSSSSSSSS', 'SWWWWWWWWWWWWWWS', 'SWSSSSSSSSSSSSWS', 'SWSWWWWWWWWWSWWS',
    'SWSWSSSSSSSWSWWS', 'SWSWSWWWWWSWSWWS', 'SWSWSWSSSWSWSWWS', 'SWSWSWSWSWSWSWWS',
    'SWSWSWSSSWSWSWWS', 'SWSWSWWWWWSWSWWS', 'SWSWSSSSSSSWSWWS', 'SWSWWWWWWWWWSWWS',
    'SWSSSSSSSSSSSSWS', 'SWWWWWWWWWWWWWWS', 'SWWWWWWWWWWWWWWS', 'SSSSSSSSSSSSSSSS',
  ],
};

export const OFFICE_WORLD_ATLAS_SOURCE: IndexedPixelAtlasSource = {
  atlasId: 'office-world.v1',
  catalogVersion: '1',
  paletteId: 'agent-office.warm-retro.v1',
  palette,
  frames: Object.entries(tileSources).map(([frameId, rows]): IndexedPixelFrameSource => ({
    frameId: `office.${frameId}`,
    width: 16,
    height: 16,
    rows,
    pivotX: 8,
    pivotY: 8,
    anchorFootX: 8,
    anchorFootY: 15,
    durationMs: 0,
    allowedMirrorX: false,
    semanticLayer: 'FACILITY',
  })),
};
