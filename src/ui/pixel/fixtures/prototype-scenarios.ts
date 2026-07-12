export interface PixelPrototypeScenario {
  readonly matrixId: `PIXEL-V${string}`;
  readonly scenarioId: string;
  readonly fixtureId: string;
  readonly logicalTimeMs: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly reducedMotion: boolean;
  readonly baselineName: string;
  readonly deliveryFileName: string | null;
}

export const PIXEL_PROTOTYPE_SCENARIOS = [
  scenario('PIXEL-V01', 'full-office', 'prototype.full-office.v1', 0, 1440, 900, 'pixel-v01-full-office.png', 'full-office.png'),
  scenario('PIXEL-V02', 'foundation-active', 'prototype.foundation-active.v1', 4500, 1440, 900, 'pixel-v02-foundation-active.png', 'team-activity.png'),
  scenario('PIXEL-V03', 'vibenews-active', 'prototype.vibenews-active.v1', 7500, 1440, 900, 'pixel-v03-vibenews-active.png', null),
  scenario('PIXEL-V04', 'advisor-handoff', 'prototype.advisor-handoff.v1', 10_500, 1440, 900, 'pixel-v04-advisor-handoff.png', null),
  scenario('PIXEL-V05', 'reviewer-active', 'prototype.reviewer-active.v1', 13_500, 1440, 900, 'pixel-v05-reviewer-active.png', null),
  scenario('PIXEL-V06', 'lounge-idle', 'prototype.lounge-idle.v1', 16_000, 1440, 900, 'pixel-v06-lounge-idle.png', 'lounge.png'),
  scenario('PIXEL-V07', 'channy-roam', 'prototype.channy-roam.v1', 18_000, 1440, 900, 'pixel-v07-channy-roam.png', 'channy.png'),
  scenario('PIXEL-V08', 'channy-eat', 'prototype.channy-eat.v1', 20_000, 1440, 900, 'pixel-v08-channy-eat.png', null),
  scenario('PIXEL-V09', 'channy-sleep', 'prototype.channy-sleep.v1', 22_000, 1440, 900, 'pixel-v09-channy-sleep.png', null),
  scenario('PIXEL-V10', 'waiting-leo', 'prototype.waiting-leo.v1', 23_500, 1440, 900, 'pixel-v10-waiting-leo.png', null),
  scenario('PIXEL-V11', 'blocked', 'prototype.blocked.v1', 25_000, 1440, 900, 'pixel-v11-blocked.png', null),
  scenario('PIXEL-V12', 'mobile-foundation', 'prototype.mobile-foundation.v1', 4500, 390, 844, 'pixel-v12-mobile-foundation.png', 'mobile.png'),
  {
    ...scenario('PIXEL-V13', 'reduced-static', 'prototype.reduced-static.v1', 10_500, 1440, 900, 'pixel-v13-reduced-static.png', null),
    reducedMotion: true,
  },
] as const satisfies readonly PixelPrototypeScenario[];

export function requirePrototypeScenario(scenarioId: string): PixelPrototypeScenario {
  const scenario = PIXEL_PROTOTYPE_SCENARIOS.find((candidate) => candidate.scenarioId === scenarioId);
  if (scenario === undefined) throw new TypeError(`unknown pixel prototype scenario: ${scenarioId}`);
  return scenario;
}

function scenario(
  matrixId: PixelPrototypeScenario['matrixId'],
  scenarioId: string,
  fixtureId: string,
  logicalTimeMs: number,
  width: number,
  height: number,
  baselineName: string,
  deliveryFileName: string | null,
): PixelPrototypeScenario {
  return {
    matrixId,
    scenarioId,
    fixtureId,
    logicalTimeMs,
    viewport: { width, height },
    reducedMotion: false,
    baselineName,
    deliveryFileName,
  };
}
