export type PixelRgba = readonly [number, number, number, number];

export const LIVING_OFFICE_PALETTE = {
  transparent: [0, 0, 0, 0],
  ink: [30, 28, 40, 255],
  midnight: [24, 31, 49, 255],
  slate: [54, 65, 88, 255],
  wall: [242, 202, 142, 255],
  wallShadow: [174, 114, 83, 255],
  floor: [166, 111, 78, 255],
  floorLight: [193, 137, 91, 255],
  glass: [115, 201, 210, 190],
  paper: [255, 238, 202, 255],
  plant: [80, 159, 92, 255],
  monitor: [70, 217, 202, 255],
  coral: [239, 111, 118, 255],
  mint: [93, 211, 167, 255],
  foundation: [80, 136, 224, 255],
  vibe: [159, 105, 220, 255],
  amber: [240, 159, 66, 255],
  control: [91, 105, 133, 255],
  cream: [255, 226, 174, 255],
  channy: [213, 205, 190, 255],
  channyShadow: [116, 106, 104, 255],
  critical: [243, 80, 91, 255],
} as const satisfies Readonly<Record<string, PixelRgba>>;

export const PROJECT_PIXEL_COLORS = {
  cosmile: { primary: 0xef6f76, secondary: 0xffb0b5 },
  siasiu: { primary: 0x5dd3a7, secondary: 0xb8f1d8 },
  foundation: { primary: 0x5088e0, secondary: 0xaac8ff },
  vibenews: { primary: 0x9f69dc, secondary: 0xd9b9ff },
  'agent-office': { primary: 0xf09f42, secondary: 0xffd28d },
  control: { primary: 0x5b6985, secondary: 0x81a7dc },
} as const;
