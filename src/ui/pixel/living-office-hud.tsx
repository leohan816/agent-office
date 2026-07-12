import type { PixelRendererBackend, PixelWorldFrameV1 } from './contracts.js';

export interface LivingOfficeHudProps {
  readonly frame: PixelWorldFrameV1;
  readonly backend: PixelRendererBackend;
  readonly running: boolean;
  readonly complete: boolean;
}

export function LivingOfficeHud({ frame, backend, running, complete }: LivingOfficeHudProps) {
  return (
    <header className="living-office-hud" id="living-office-status">
      <div className="living-office-hud__brand">
        <span aria-hidden="true" className="living-office-hud__logo">AO</span>
        <div>
          <p className="living-office-hud__eyebrow">SYNTHETIC PROTOTYPE / AO12-PWU-11-P1 VISUAL PATCH</p>
          <h1>Agent Office: Living Pixel Office</h1>
        </div>
      </div>
      <div className="living-office-hud__badges" aria-label="Prototype status">
        <span data-backend={backend}>{backend}</span>
        <span>{frame.presentationTier}</span>
        <span>{complete ? 'TOUR COMPLETE' : running ? 'TOUR RUNNING' : 'FROZEN FRAME'}</span>
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
