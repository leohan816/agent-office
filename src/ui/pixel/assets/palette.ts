export type PixelRgba = readonly [number, number, number, number];

export const LIVING_OFFICE_PALETTE = {
  transparent: [0, 0, 0, 0],
  ink: [55, 58, 61, 255],
  midnight: [76, 78, 80, 255],
  slate: [112, 116, 120, 255],
  wall: [247, 244, 236, 255],
  wallShadow: [207, 199, 187, 255],
  floor: [215, 188, 151, 255],
  floorLight: [235, 216, 187, 255],
  glass: [157, 205, 220, 190],
  paper: [255, 252, 244, 255],
  plant: [91, 143, 101, 255],
  monitor: [101, 164, 178, 255],
  coral: [214, 127, 130, 255],
  mint: [101, 170, 139, 255],
  foundation: [93, 131, 181, 255],
  vibe: [139, 115, 174, 255],
  amber: [200, 138, 80, 255],
  control: [109, 119, 133, 255],
  cream: [248, 240, 224, 255],
  channy: [215, 212, 207, 255],
  channyShadow: [104, 102, 101, 255],
  critical: [243, 80, 91, 255],
} as const satisfies Readonly<Record<string, PixelRgba>>;

export const PROJECT_PIXEL_COLORS = {
  cosmile: { primary: 0xd67f82, secondary: 0xf0b3b0 },
  siasiu: { primary: 0x65aa8b, secondary: 0xb7d9c8 },
  foundation: { primary: 0x5d83b5, secondary: 0xb9cbe2 },
  vibenews: { primary: 0x8b73ae, secondary: 0xd1c3df },
  'agent-office': { primary: 0xc88a50, secondary: 0xe5c39e },
  control: { primary: 0x6d7785, secondary: 0xb7bec7 },
} as const;
