# Agent Office

Agent Office is the loopback-only M01 web control plane for canonical mission
projection and structured Leo-to-Advisor communication. The repository contains
the accepted Batch A-D foundation, Batch E runtime/PWA/recovery work, the final
runtime reworks, and the LocalBootstrap private-run gate implemented at
`2623922877bd52dc7f5b6c6cd45fae755e5ff228`. The reviewed exact Advisor
pointer bridge is implemented but deliberately unconfigured and disabled pending
Fable5 implementation/security review and a separately authorized rehearsal.

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
- Committed configuration still reports Advisor delivery as
  `MANUAL_FALLBACK_REQUIRED`. Production now supports only a matching, trusted
  v3/v2 exact-delivery selection; no such descriptor or usable authority
  material is committed. Caller-injected ports/capabilities are production-
  rejected and remain explicit synthetic-test seams only.
- The implemented bridge verifies eight exact Git authority snapshots, a
  one-use readiness lease, and two fixed `$9/@9/%9` preflights before minting an
  in-memory notification capability. Its immutable pointer, fixed no-shell tmux
  argv, fsynced no-resend journal, local disable latch, and committed Advisor
  evidence ingress have no browser target/control surface.
- The production UI has a restrained Korean proof-login state, explicit
  LocalBootstrap authentication/mutation badges, logout, responsive containment,
  reduced-motion behavior, and static-only PWA caching. Proofs and session values
  are not placed in URLs, browser storage, service-worker caches, logs, audit
  payloads, source, or committed artifacts.

AO-WU-19 created no credential, readiness lease, activation descriptor,
capability, proof, state root, listener, or real tmux input and left no server
running. Exact-delivery preparation is documented in
[docs/operations/EXACT_ADVISOR_DELIVERY_PREPARATION.md](docs/operations/EXACT_ADVISOR_DELIVERY_PREPARATION.md);
AO-WU-21 remains separately gated.

## Verification

```text
npm ci
npm run check
npm run test:e2e
npm run smoke:runtime
npm run audit:dependencies
git diff --check
```

The complete verification includes the existing LocalBootstrap regressions plus
focused exact-delivery authority/config/preflight/argv/journal/crash/latch and
Git evidence-ingress tests, lint, strict typecheck, core/dashboard builds,
Playwright, the disposable read-only runtime smoke, dependency audit, diff
hygiene, credential-pattern scanning, and direct baseline inspection.
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
