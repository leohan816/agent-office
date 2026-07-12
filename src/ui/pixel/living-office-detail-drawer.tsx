import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

import type { PixelWorldFrameV1 } from './contracts.js';

export interface LivingOfficeDetailDrawerProps {
  readonly frame: PixelWorldFrameV1;
  readonly open: boolean;
  readonly automatic: boolean;
  readonly invokerRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: () => void;
}

export function LivingOfficeDetailDrawer({
  frame,
  open,
  automatic,
  invokerRef,
  onClose,
}: LivingOfficeDetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open && !automatic) closeRef.current?.focus();
  }, [automatic, open]);
  if (!open) return null;

  const close = () => {
    onClose();
    if (!automatic) invokerRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <aside
      aria-labelledby="living-office-detail-heading"
      aria-modal={automatic ? undefined : 'true'}
      className="living-office-detail"
      data-automatic-presentation={automatic}
      onKeyDown={onKeyDown}
      role={automatic ? 'complementary' : 'dialog'}
    >
      <div className="living-office-detail__bar">
        <div>
          <p>Secondary DOM technical panel</p>
          <h2 id="living-office-detail-heading">{frame.hud.projectName} evidence detail</h2>
        </div>
        <button onClick={close} ref={closeRef} type="button">Close detail</button>
      </div>
      <dl>
        <div><dt>Frame contract</dt><dd>{frame.schemaVersion}</dd></div>
        <div><dt>Frame key</dt><dd>{frame.frameKey}</dd></div>
        <div><dt>Projection revision</dt><dd>{frame.projectionRevision}</dd></div>
        <div><dt>Logical time</dt><dd>{Math.round(frame.logicalTimeMs)}ms</dd></div>
        <div><dt>Accepted cue IDs</dt><dd>{frame.acceptedCueIds.join(', ') || 'NONE'}</dd></div>
        <div><dt>Route</dt><dd>{frame.route?.staticEquivalent ?? 'NONE'}</dd></div>
        <div><dt>Evidence classification</dt><dd>SYNTHETIC PROTOTYPE / no production or authority claim</dd></div>
        <div><dt>Fallback</dt><dd>DOM static and unchanged M1 remain available</dd></div>
      </dl>
    </aside>
  );
}
