import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import { Dashboard } from '../dashboard.js';
import { RuntimeBoundary } from '../pwa/runtime-boundary.js';
import {
  AgentOfficeRuntimeClient,
  type RuntimeClientState,
} from './client.js';

export interface ProductionRuntimeAppProps {
  readonly client: AgentOfficeRuntimeClient;
}

export function ProductionRuntimeApp({ client }: ProductionRuntimeAppProps) {
  const [state, setState] = useState<RuntimeClientState>(() => client.snapshot());
  const [proof, setProof] = useState('');
  const [loginError, setLoginError] = useState<string>();
  const [loginPending, setLoginPending] = useState(false);
  useEffect(() => {
    const unsubscribe = client.subscribe(setState);
    void client.start();
    return () => {
      unsubscribe();
      client.stop();
    };
  }, [client]);
  const actionPort = useMemo(() => client.communicationActionPort(), [client, state]);
  const localBootstrap = state.status?.authMode === 'LOCAL_BOOTSTRAP';
  const runtimeBoundary = {
    authState: state.subject === undefined
      ? localBootstrap
        ? 'LOGIN_REQUIRED' as const
        : 'AUTH_BLOCKED' as const
      : localBootstrap
        ? 'LOCAL_BOOTSTRAP_AUTHENTICATED' as const
        : 'TEST_AUTHENTICATED' as const,
    mutationState: actionPort === undefined
      ? 'READ_ONLY' as const
      : localBootstrap
        ? 'LOCAL_BOOTSTRAP_ENABLED' as const
        : 'TEST_MUTATION_ENABLED' as const,
    deliveryState:
      state.status?.deliveryMode === 'ENABLED'
        ? 'READY' as const
        : state.status?.deliveryMode === 'DISABLED'
          ? 'DISABLED' as const
          : 'MANUAL_FALLBACK_REQUIRED' as const,
    ...(state.subject === undefined ? {} : { onLogout: () => client.logout() }),
  };
  const submitLogin = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const submittedProof = proof;
    setProof('');
    setLoginError(undefined);
    setLoginPending(true);
    try {
      await client.login(submittedProof);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'AUTHENTICATION_REQUIRED');
    } finally {
      setLoginPending(false);
    }
  };
  const projection = state.projection;
  if (
    projection?.dashboard !== undefined &&
    projection.communication !== undefined &&
    projection.sceneRoles !== undefined
  ) {
    return (
      <Dashboard
        model={projection.dashboard}
        communicationModel={projection.communication}
        {...(actionPort === undefined ? {} : { communicationActionPort: actionPort })}
        runtimeBoundary={runtimeBoundary}
        showOfficeScene
        sceneRoles={projection.sceneRoles}
      />
    );
  }
  return (
    <div className="app-shell production-runtime-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div>
            <p className="eyebrow">AGENT OFFICE / M01</p>
            <h1>Private runtime</h1>
          </div>
        </div>
        <div className="topbar-status" aria-label="Runtime status">
          <span className="status-token">APPLICATION RUNTIME</span>
          <span className="status-token">{state.phase}</span>
          <span className="status-token">SSE: {state.sseState}</span>
        </div>
      </header>
      <RuntimeBoundary {...runtimeBoundary} />
      <main className="runtime-fail-closed" aria-labelledby="runtime-fail-closed-heading">
        <p className="eyebrow">FAIL-CLOSED APPLICATION STATE</p>
        <h2 id="runtime-fail-closed-heading">
          {state.phase === 'AUTH_BLOCKED' ? 'AUTH_BLOCKED / READ_ONLY' : state.phase}
        </h2>
        <p>
          The built loopback shell is available, but the protected projection and Advisor
          mutations require an approved authenticated session.
        </p>
        {state.phase === 'LOGIN_REQUIRED' ? (
          <form className="local-bootstrap-login" onSubmit={(event) => void submitLogin(event)}>
            <div>
              <p className="eyebrow">LOCAL BOOTSTRAP</p>
              <h3>로컬 인증 증명</h3>
              <p>
                소유자 전용 로컬 파일로 전달된 일회용 증명을 입력하세요.
                Advisor 전달 준비 상태와 로그인 상태는 별도로 표시됩니다.
              </p>
            </div>
            <label htmlFor="local-bootstrap-proof">일회용 인증 증명</label>
            <input
              id="local-bootstrap-proof"
              name="proof"
              type="password"
              autoComplete="one-time-code"
              spellCheck={false}
              minLength={43}
              maxLength={43}
              pattern="[A-Za-z0-9_-]{43}"
              required
              value={proof}
              onChange={(event) => setProof(event.currentTarget.value)}
            />
            <button type="submit" disabled={loginPending}>
              {loginPending ? '인증 확인 중' : '로그인'}
            </button>
            {loginError === undefined ? null : (
              <p className="local-bootstrap-error" role="alert">{loginError}</p>
            )}
          </form>
        ) : null}
        {state.phase === 'LOGGED_OUT' || state.phase === 'SESSION_EXPIRED' ? (
          <p className="local-bootstrap-restart" role="status">
            세션이 종료되었습니다. 새 일회용 증명을 받으려면 서비스를 안전하게 다시 시작하세요.
          </p>
        ) : null}
        <dl className="communication-metadata">
          <div><dt>NETWORK</dt><dd>LOOPBACK_PRIVATE</dd></div>
          <div><dt>STARTUP</dt><dd>{state.status?.startupState ?? 'STATUS_UNAVAILABLE'}</dd></div>
          <div><dt>MUTATION</dt><dd>{state.status?.mutationMode ?? 'DISABLED'}</dd></div>
          <div><dt>PROJECTION</dt><dd>{state.lastErrorCode ?? 'AUTHENTICATION_REQUIRED'}</dd></div>
          <div><dt>SSE</dt><dd>{state.sseState}</dd></div>
        </dl>
        <p>
          No synthetic fixture, localhost identity, NoAuth provider, role-dispatch path, or
          Advisor delivery authority is active.
        </p>
      </main>
    </div>
  );
}
