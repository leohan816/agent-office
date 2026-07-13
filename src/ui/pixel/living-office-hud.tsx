import type { PixelRendererBackend, PixelWorldFrameV1 } from './contracts.js';

export interface LivingOfficeHudProps {
  readonly frame: PixelWorldFrameV1;
  // `PENDING` (I2-1): the child render host has not yet reported a successful `onInit`, so no backend
  // is advertised. The shared HUD renders it truthfully as INITIALIZING (never WEBGL/CANVAS pre-init).
  readonly backend: PixelRendererBackend | 'PENDING';
  readonly running: boolean;
  readonly complete: boolean;
  // I2-4: the authenticated production surface is a continuous fixture-free ambient office (no 26s
  // tour). The prototype demo keeps its tour wording. Defaults to PROTOTYPE for the frozen prototype entry.
  readonly surfaceKind?: 'PROTOTYPE' | 'PRODUCTION';
}

export function LivingOfficeHud({
  frame,
  backend,
  running,
  complete,
  surfaceKind = 'PROTOTYPE',
}: LivingOfficeHudProps) {
  // The eyebrow is carried by the producing projector on `frame.hud.eyebrow` (prototype vs
  // authenticated Office); the shared HUD embeds no fixture/prototype default of its own.
  const production = surfaceKind === 'PRODUCTION';
  const backendLabel = backend === 'PENDING' ? 'INITIALIZING' : backend;
  const activityLabel = production
    ? backend === 'PENDING' ? 'INITIALIZING' : running ? 'CONTINUOUS AMBIENT' : 'STATIC OFFICE'
    : complete ? 'TOUR COMPLETE' : running ? 'TOUR RUNNING' : 'FROZEN FRAME';
  return (
    <header className="living-office-hud" id="living-office-status">
      <div className="living-office-hud__brand">
        <span aria-hidden="true" className="living-office-hud__logo">AO</span>
        <div>
          <p className="living-office-hud__eyebrow">{frame.hud.eyebrow}</p>
          <h1>Agent Office: Living Pixel Office</h1>
        </div>
      </div>
      <div className="living-office-hud__badges" aria-label={production ? 'Office renderer status' : 'Prototype status'}>
        <span data-backend={backend}>{backendLabel}</span>
        <span>{frame.presentationTier}</span>
        <span>{activityLabel}</span>
      </div>
      <dl className="living-office-hud__facts">
        <div><dt>Advisor Team</dt><dd>{frame.hud.selectedTeamName}</dd></div>
        <div><dt>Project</dt><dd>{frame.hud.projectName}</dd></div>
        <div><dt>Mission</dt><dd>{frame.hud.missionShortLabel}</dd></div>
        <div><dt>WorkUnit</dt><dd>{frame.hud.currentWorkUnitShortId}</dd></div>
        <div><dt>Actor</dt><dd>{frame.hud.currentActorRoleInstanceId}</dd></div>
        <div><dt>State</dt><dd data-state={frame.hud.operationalState}>{frame.hud.operationalState}</dd></div>
        <div><dt>Progress</dt><dd>{frame.hud.workUnitProgress} / gates {frame.hud.requiredGateProgress}</dd></div>
      </dl>
      <p className="living-office-hud__status" role="status">
        {frame.hud.statusLine}
      </p>
      {frame.hud.blockerSummary === null ? null : (
        <p className="living-office-hud__blocker" role="alert">{frame.hud.blockerSummary}</p>
      )}
    </header>
  );
}
