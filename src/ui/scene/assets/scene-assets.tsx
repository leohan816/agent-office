import type { SceneStateName } from '../types.js';

interface AssetProps {
  readonly className?: string;
}

export function ActorAsset({ stateName, className }: AssetProps & { readonly stateName: SceneStateName }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-asset="actor"
      data-state={stateName}
      viewBox="0 0 96 72"
      width="96"
      height="72"
    >
      <circle className="asset-actor-head" cx="48" cy="18" r="10" />
      <path className="asset-actor-body" d="M31 63V45c0-10 7-17 17-17s17 7 17 17v18H31Z" />
      <path className="asset-actor-arm" d="M34 42 20 54M62 42l14 12" />
      <circle className="asset-status-light" cx="82" cy="12" r="5" />
    </svg>
  );
}

export function DeskAsset({ className }: AssetProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-asset="desk"
      viewBox="0 0 120 48"
      width="120"
      height="48"
    >
      <path className="asset-desk-top" d="M7 9h106v13H7z" />
      <path className="asset-desk-leg" d="M17 22h8v22h-8zM95 22h8v22h-8z" />
      <path className="asset-desk-tray" d="M74 3h31v6H74z" />
      <path className="asset-desk-keyboard" d="M42 4h33l5 8H37l5-8Z" />
    </svg>
  );
}

export function DocumentAsset({ kind, className }: AssetProps & { readonly kind: 'work' | 'result' | 'decision' | 'patch' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-asset="document"
      data-kind={kind}
      viewBox="0 0 32 40"
      width="32"
      height="40"
    >
      <path className="asset-document-sheet" d="M5 2h14l8 8v28H5z" />
      <path className="asset-document-fold" d="M19 2v9h8" />
      <path className="asset-document-line" d="M10 18h12M10 24h12M10 30h8" />
    </svg>
  );
}

export function BarrierAsset({ className }: AssetProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-asset="barrier"
      viewBox="0 0 52 40"
      width="52"
      height="40"
    >
      <path className="asset-barrier-board" d="M3 8h46v17H3z" />
      <path className="asset-barrier-stripe" d="m8 25 12-17M23 25 35 8M38 25 49 10" />
      <path className="asset-barrier-leg" d="M12 25v12M40 25v12M6 37h13M33 37h13" />
    </svg>
  );
}

export function ToolAsset({ className }: AssetProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-asset="tool"
      viewBox="0 0 44 44"
      width="44"
      height="44"
    >
      <path className="asset-tool-ring" d="M29 6a10 10 0 0 0-9 14L7 33l4 4 13-13a10 10 0 0 0 14-9l-7 5-6-6 4-8Z" />
      <path className="asset-tool-check" d="m16 30 3 3 7-8" />
    </svg>
  );
}

export function WarningAsset({ className }: AssetProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-asset="warning"
      viewBox="0 0 44 40"
      width="44"
      height="40"
    >
      <path className="asset-warning-shape" d="M22 3 41 36H3L22 3Z" />
      <path className="asset-warning-mark" d="M22 14v11M22 30v2" />
    </svg>
  );
}
