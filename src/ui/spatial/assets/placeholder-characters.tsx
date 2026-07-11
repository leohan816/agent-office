export const SPATIAL_ROLE_CATEGORIES = [
  'LEO_DECISION',
  'ADVISOR_ROUTING',
  'CONTROL_RECOVERY',
  'INDEPENDENT_REVIEW',
  'WORKER_BUILD',
  'GENERIC_REGISTERED',
] as const;

export type SpatialRoleCategory = (typeof SPATIAL_ROLE_CATEGORIES)[number];

export interface ActorPlaceholderProps {
  readonly roleCategory: SpatialRoleCategory;
  readonly accent: string;
}

export function ActorPlaceholder({ roleCategory, accent }: ActorPlaceholderProps) {
  return (
    <svg
      aria-hidden="true"
      className="spatial-placeholder spatial-placeholder-actor"
      focusable="false"
      height="96"
      viewBox="0 0 96 96"
      width="96"
    >
      <rect fill="#17202a" height="94" rx="14" stroke="#708090" strokeWidth="2" width="94" x="1" y="1" />
      <path d="M24 76h48v10H24z" fill="#5d3b28" />
      <path d="M30 84h6v9h-6zm30 0h6v9h-6z" fill="#9a6a44" />
      <path d="M34 48h28l8 28H26z" fill={accent} stroke="#f5f7fa" strokeWidth="2" />
      <rect fill="#f0c7a5" height="25" rx="8" stroke="#f5f7fa" strokeWidth="2" width="26" x="35" y="18" />
      <path d="M35 26c4-12 24-12 27 1v5H35z" fill="#3c2d2a" />
      <rect fill="#263746" height="3" width="4" x="41" y="31" />
      <rect fill="#263746" height="3" width="4" x="52" y="31" />
      <path d="M44 38h9" stroke="#8e4f4f" strokeWidth="2" />
      <RoleCue roleCategory={roleCategory} />
    </svg>
  );
}

export function RouteCharacterPlaceholder({ accent }: { readonly accent: string }) {
  return (
    <svg aria-hidden="true" className="spatial-placeholder" focusable="false" height="48" viewBox="0 0 48 48" width="48">
      <rect fill="#17202a" height="46" rx="8" stroke="#708090" strokeWidth="2" width="46" x="1" y="1" />
      <circle cx="24" cy="14" fill="#f0c7a5" r="7" stroke="#f5f7fa" strokeWidth="2" />
      <path d="M14 41c1-13 5-19 10-19s9 6 10 19z" fill={accent} stroke="#f5f7fa" strokeWidth="2" />
      <path d="m36 20 8 4-8 4" fill="none" stroke="#f2c86f" strokeWidth="3" />
    </svg>
  );
}

function RoleCue({ roleCategory }: { readonly roleCategory: SpatialRoleCategory }) {
  switch (roleCategory) {
    case 'LEO_DECISION':
      return <path d="M67 12h17v24H67zm4 6h9m-9 5h9m-9 5h6" fill="#f4ead0" stroke="#d8a957" strokeWidth="2" />;
    case 'ADVISOR_ROUTING':
      return <path d="M12 19h17v14H12zm3 5h11m-7-4v18" fill="#d7ecff" stroke="#6facdf" strokeWidth="2" />;
    case 'CONTROL_RECOVERY':
      return <path d="M13 14h18v18H13zm4 5h10m-10 6h6" fill="#dce5eb" stroke="#7fa1b5" strokeWidth="2" />;
    case 'INDEPENDENT_REVIEW':
      return <g><circle cx="75" cy="22" fill="none" r="9" stroke="#e3d8ff" strokeWidth="3" /><path d="m81 29 7 8" stroke="#e3d8ff" strokeWidth="3" /></g>;
    case 'WORKER_BUILD':
      return <path d="m74 14 7 7-13 13-7-7zm-15 18 5 5" fill="#ffe0b5" stroke="#e1a151" strokeWidth="2" />;
    case 'GENERIC_REGISTERED':
      return <circle cx="76" cy="23" fill="#dce5eb" r="9" stroke="#7fa1b5" strokeWidth="2" />;
  }
}

export function RoleGlyphPlaceholder({ roleCategory }: { readonly roleCategory: SpatialRoleCategory }) {
  const symbols: Readonly<Record<SpatialRoleCategory, string>> = {
    LEO_DECISION: 'D',
    ADVISOR_ROUTING: 'A',
    CONTROL_RECOVERY: 'C',
    INDEPENDENT_REVIEW: 'R',
    WORKER_BUILD: 'W',
    GENERIC_REGISTERED: 'G',
  };
  return (
    <svg aria-hidden="true" className="spatial-placeholder" focusable="false" height="24" viewBox="0 0 24 24" width="24">
      <rect fill="#17202a" height="21" rx="4" stroke="currentColor" strokeWidth="2" width="21" x="1.5" y="1.5" />
      <text fill="currentColor" fontFamily="monospace" fontSize="12" fontWeight="800" textAnchor="middle" x="12" y="16">
        {symbols[roleCategory]}
      </text>
    </svg>
  );
}

export function ProjectGlyphPlaceholder({ label }: { readonly label: string }) {
  return (
    <svg aria-hidden="true" className="spatial-placeholder" focusable="false" height="24" viewBox="0 0 24 24" width="24">
      <path d="M12 1 22 7v10l-10 6-10-6V7z" fill="none" stroke="currentColor" strokeWidth="2" />
      <text fill="currentColor" fontFamily="monospace" fontSize="8" fontWeight="800" textAnchor="middle" x="12" y="15">
        {label.slice(0, 2)}
      </text>
    </svg>
  );
}

export function AssignmentBadgePlaceholder({ label }: { readonly label: string }) {
  return (
    <svg aria-hidden="true" className="spatial-placeholder" focusable="false" height="20" viewBox="0 0 48 20" width="48">
      <path d="M2 2h44v16H2z" fill="#17202a" stroke="currentColor" strokeWidth="2" />
      <text fill="currentColor" fontFamily="monospace" fontSize="8" fontWeight="800" textAnchor="middle" x="24" y="13">
        {label.slice(0, 6)}
      </text>
    </svg>
  );
}

export function ChannyPlaceholder() {
  return (
    <svg
      aria-hidden="true"
      className="spatial-placeholder spatial-placeholder-channy"
      focusable="false"
      height="72"
      viewBox="0 0 72 72"
      width="72"
    >
      <rect fill="#17202a" height="70" rx="14" stroke="#708090" strokeWidth="2" width="70" x="1" y="1" />
      <path d="M18 43c0-13 10-22 24-22 11 0 18 8 18 19v14H21c-2-3-3-7-3-11z" fill="#dfd5c5" stroke="#f7f2ea" strokeWidth="2" />
      <path d="M19 20c8-7 15-1 14 10-9 4-15 0-14-10zm33 0c7-6 13 1 10 10-7 3-12-1-10-10z" fill="#aaa092" />
      <circle cx="48" cy="34" fill="#1b2530" r="2" />
      <path d="M54 39h7l-4 4z" fill="#1b2530" />
      <path d="M27 53v12m23-12v12" stroke="#dfd5c5" strokeWidth="6" />
      <path d="M16 42c-8-6-9 4-4 7" fill="none" stroke="#dfd5c5" strokeWidth="4" />
    </svg>
  );
}

export const SPATIAL_FACILITY_KINDS = [
  'WOOD_DESK',
  'GLASS_MEETING_ROOM',
  'COFFEE_LOUNGE',
  'SHARED_PATH',
  'PROJECT_SIGN',
  'MISSION_BOARD',
  'REVIEWER_BOOTH',
  'ADVISOR_HUB',
  'CHANNY_FACILITIES',
] as const;

export type SpatialFacilityKind = (typeof SPATIAL_FACILITY_KINDS)[number];

export function FacilityPlaceholder({ kind }: { readonly kind: SpatialFacilityKind }) {
  return (
    <svg
      aria-hidden="true"
      className={`spatial-placeholder spatial-facility-${kind.toLocaleLowerCase('en-US')}`}
      focusable="false"
      height="64"
      viewBox="0 0 120 64"
      width="120"
    >
      <FacilityShape kind={kind} />
    </svg>
  );
}

function FacilityShape({ kind }: { readonly kind: SpatialFacilityKind }) {
  switch (kind) {
    case 'WOOD_DESK':
      return <g><path d="M8 17h104v25H8z" fill="#8c5d37" stroke="#d2a06d" strokeWidth="3" /><path d="M18 42v17m84-17v17" stroke="#d2a06d" strokeWidth="5" /></g>;
    case 'GLASS_MEETING_ROOM':
      return <g><path d="M8 7h104v50H8z" fill="#6bb5c91c" stroke="#81ccdc" strokeWidth="3" /><path d="M47 7v50m26-50v50" stroke="#81ccdc" strokeWidth="2" /><path d="M52 40h16" stroke="#f4d794" strokeWidth="3" /></g>;
    case 'COFFEE_LOUNGE':
      return <g><path d="M18 37h46v19H18z" fill="#665044" stroke="#c99b77" strokeWidth="3" /><path d="M77 23h23v26H77zm23 6h9v12h-9" fill="#e7e0d5" stroke="#c99b77" strokeWidth="3" /><path d="M81 15c3-5 6 0 3 4m9-4c3-5 6 0 3 4" fill="none" stroke="#f3d59a" strokeWidth="2" /></g>;
    case 'SHARED_PATH':
      return <g><path d="M5 40h110" stroke="#a0a8af" strokeDasharray="10 8" strokeWidth="12" /><path d="m99 28 16 12-16 12" fill="none" stroke="#dce5eb" strokeWidth="4" /></g>;
    case 'PROJECT_SIGN':
      return <g><path d="M16 8h88v38H16z" fill="#263746" stroke="#f0c36a" strokeWidth="3" /><path d="M34 46v13m52-13v13" stroke="#f0c36a" strokeWidth="4" /><path d="M29 22h62m-49 10h36" stroke="#eef3f7" strokeWidth="3" /></g>;
    case 'MISSION_BOARD':
      return <g><path d="M9 6h102v52H9z" fill="#183449" stroke="#79bde3" strokeWidth="3" /><path d="M20 18h31v10H20zm39 0h40v10H59zM20 36h79v10H20z" fill="#dfeaf2" opacity="0.9" /></g>;
    case 'REVIEWER_BOOTH':
      return <g><path d="M11 8h98v50H11z" fill="#332448" stroke="#c5a6e8" strokeWidth="3" /><circle cx="46" cy="31" fill="none" r="12" stroke="#eee4fa" strokeWidth="4" /><path d="m55 40 13 13m10-35h20m-20 10h15m-15 10h20" stroke="#eee4fa" strokeWidth="4" /></g>;
    case 'ADVISOR_HUB':
      return <g><path d="M9 10h102v44H9z" fill="#17334c" stroke="#78b8e8" strokeWidth="3" /><path d="M19 20h29v24H19zm41 4h37m-37 10h29" fill="#dceeff" stroke="#dceeff" strokeWidth="3" /><path d="m99 34 10 0-7 7" fill="none" stroke="#f2c86f" strokeWidth="3" /></g>;
    case 'CHANNY_FACILITIES':
      return <g><path d="M8 28h52v26H8z" fill="#5e493f" stroke="#d6b39c" strokeWidth="3" /><path d="M13 23h42v16H13z" fill="#b38a72" /><path d="M72 43c2 13 32 13 34 0z" fill="#d8a05a" stroke="#f3d6a9" strokeWidth="3" /><path d="M76 36h26" stroke="#f3d6a9" strokeWidth="3" /><path d="M83 48h12" stroke="#80c7db" strokeWidth="4" /></g>;
  }
}
