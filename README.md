# Agent Office

Agent Office is the loopback-only M01 web control plane for canonical mission
projection and structured Leo-to-Advisor communication. The repository contains
the accepted Batch A-D foundation, Batch E runtime/PWA/recovery work, the final
runtime reworks, and the LocalBootstrap private-run gate implemented at
`2623922877bd52dc7f5b6c6cd45fae755e5ff228`.

## Current as-built boundary

- The default committed deployment remains `LOOPBACK_PRIVATE`,
  `NONE_READ_ONLY`, mutation-disabled, and visibly `AUTH_BLOCKED`.
- An explicit owner-controlled deployment configuration may select the exact
  `LOCAL_BOOTSTRAP` / `ENABLED_LOCAL_BOOTSTRAP` mode. That mode binds only
  `127.0.0.1:4317`; CORS, proxy trust, TLS, and HSTS remain disabled.
- Production LocalBootstrap generates one cryptographically random proof and
  writes it once to a caller-selected owner-only `0600` file in an isolated
  `0700` directory outside Git. Provider state retains only a salted verifier.
- The bounded same-origin exchange creates a server-side session with only
  `viewer` and `leo_input`. The host-only cookie is `HttpOnly` and
  `SameSite=Strict`; logout/revocation closes SSE and removes mutation access.
- Production LocalBootstrap accepts only the current Git-verified canonical M01
  manifest from the sibling `foundation-docs` repository. Fixture fallback is
  rejected before proof creation or listener binding.
- Advisor delivery remains `MANUAL_FALLBACK_REQUIRED`. LocalBootstrap rejects a
  usable tmux capability or delivery-port injection, and no real tmux input is
  sent.
- The production UI has a restrained Korean proof-login state, explicit
  LocalBootstrap authentication/mutation badges, logout, responsive containment,
  reduced-motion behavior, and static-only PWA caching. Proofs and session values
  are not placed in URLs, browser storage, service-worker caches, logs, audit
  payloads, source, or committed artifacts.

The Worker pass created no real credential, started no real private run, and
left no server running. Those actions remain deferred until independent Fable5
code/security `PASS` and a separately authorized Advisor private-run step. The
non-secret preparation procedure is
[docs/operations/LOCAL_BOOTSTRAP_PRIVATE_RUN_PREPARATION.md](docs/operations/LOCAL_BOOTSTRAP_PRIVATE_RUN_PREPARATION.md).

## Verification

```text
npm ci
npm run check
npm run test:e2e
npm run smoke:runtime
npm run audit:dependencies
git diff --check
```

The LocalBootstrap implementation gate passes 55 Vitest files / 255 tests,
18 demo/PWA Playwright tests plus 3 composed LocalBootstrap tests, lint, strict
typecheck, core/dashboard builds, the disposable read-only runtime smoke, a
zero-high-vulnerability audit, diff hygiene, credential-pattern scanning, and
direct inspection of the desktop/mobile/reduced-motion composed baselines.
Tests use only disposable roots, deterministic read-only adapters, and named
synthetic proofs; they clean their listeners and state.

## Operating boundary

- Agent Office Worker changes only explicitly approved repository scope and
  returns durable evidence to Advisor.
- Advisor routes work and audits evidence. Fable5 independently reviews in a
  separate Reviewer session. Leo/GPT retains final approval and next-mission
  authority.
- Browser actions cannot dispatch to Workers or Reviewers, execute arbitrary
  terminal commands, activate Hermes, or select a network/auth mode.
- Public or private-network exposure, Tailscale, remote hosts, databases,
  secrets in Git, real tmux delivery, production/live deployment, protected
  branches, force pushes, and automatic mission progression remain forbidden.

The working branch is `shadow/agent-office-m01`. Read `AGENTS.md`, `CLAUDE.md`,
and `docs/agent/` before changing the repository.
