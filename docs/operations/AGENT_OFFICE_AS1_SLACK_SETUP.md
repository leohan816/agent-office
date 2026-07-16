# AS1 Multi-Team Slack Pilot Setup

Status: `PHASE_B_PRIVATE_LEO_ONLY_LIVE_COMPOSITION__IMPLEMENTATION_UNDER_INDEPENDENT_REVIEW__DEFAULT_DISCONNECTED`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

This is the non-secret owner Setup Pack for two private Slack Socket Mode apps.
It does not create a pilot receive grant, activate a client, connect to Slack,
create pointer-delivery authority or a runtime capability, start Agent Office,
or authorize a real pilot. The Phase B private-Leo-only live-composition
lifecycle commands in section 7 (via the `as1:slack-pilot` CLI) are committed
**implementation under independent review** — source that has passed design
review and is being re-reviewed after a security patch, not yet accepted for a
live rehearsal — and they default to disconnected: they open no Slack connection
on their own. The committed descriptor is `enabled: false`; live connection and
owner setup remain unauthorized until the independent implementation/security
review passes, the Advisor records the owner gate, and the Advisor supplies one
exact committed/pushed unexpired `As1PilotReceiveGrantV1` for one profile.
`redacted-check` runs today and performs local syntax validation only — it is
not a live identity proof.

## 1. Fixed pilot boundary

| Slack app/bot display name | Private channel | Routed Team | Only routable Actor |
|---|---|---|---|
| `agent-office-advisor` | `team-agent-office` | `AGENT_OFFICE_ADVISOR_TEAM` | `agent-office-advisor` |
| `foundation-advisor` | `team-foundation` | `FOUNDATION_ADVISOR_TEAM` | `foundation-advisor` |

The exact app/bot display names `agent-office-advisor` and
`foundation-advisor` are operator-facing labels only and never routing
authority. The selected closed profile and immutable workspace, App, channel,
and Leo user IDs are the authority inputs. Slack text, display names, topics,
mentions, and payload fields never select a Team, Actor, tmux destination,
workspace, model, effort, command, or file path.

The pilot excludes DMs, public channels, App Home commands, slash commands,
interactive components, public Request URLs, status/agents/missions queries,
VibeNews, other users, additional routes, and direct Worker or Reviewer
dispatch.

## 2. Committed non-secret inputs

- `config/slack/agent-office-advisor.manifest.yaml`
- `config/slack/foundation-advisor.manifest.yaml`
- `config/slack/as1-slack-pilot.env.example`

Each manifest enables Socket Mode, declares only the `message.groups` bot event,
and requests `groups:history`, `chat:write`, and `users:read` bot scopes.
`users:read` is used only for the startup `bots.info` App-ID check that rejects a
bot token paired with the other app; the pilot must not list users or read user
profiles. App-level tokens are owner-created separately with only
`connections:write`. Neither manifest declares a Request URL, DM event, App
Home command or message surface: both Home and Messages tabs are explicitly
disabled. Neither manifest declares a slash command, shortcut, or interactive
action. Each profile uses its exact approved literal for both its app and bot
display name: `agent-office-advisor` or `foundation-advisor`.

## 3. Owner app creation

Perform these steps in the same intended private Slack workspace. Do not paste
any token into a repository, terminal transcript, issue, chat, or review
artifact.

### 3.1 Agent Office app

1. Create a new Slack app from
   `config/slack/agent-office-advisor.manifest.yaml`.
2. Confirm the app and bot display names are both exactly
   **agent-office-advisor**.
3. Confirm Socket Mode is enabled and no public Request URL exists.
4. Confirm the bot scopes are exactly `groups:history`, `chat:write`, and
   `users:read`, and the only subscribed bot event is `message.groups`.
5. Create one app-level token with exactly `connections:write`. Store it only in
   the external secret file described in section 5.
6. Install the app to the private workspace and store the resulting bot token
   only in that external file.
7. Create or select the private `team-agent-office` channel, invite only the
   intended pilot participants and this bot, and record its immutable channel
   ID. The channel name is operator guidance; the immutable ID is authority.
8. Record the immutable App ID from Slack app settings.

### 3.2 Foundation app

1. Create a separate Slack app from
   `config/slack/foundation-advisor.manifest.yaml`.
2. Confirm the app and bot display names are both exactly
   **foundation-advisor**.
3. Repeat the Socket Mode, no-Request-URL, exact bot-scope, and exact bot-event
   checks above.
4. Create a different app-level token with exactly `connections:write`, install
   the app, and keep both Foundation tokens only in the external secret file.
5. Create or select the private `team-foundation` channel, invite only the
   intended pilot participants and this bot, and record its immutable channel
   ID.
6. Record this app's immutable App ID.

Do not reuse an app, bot token, app token, or channel ID between profiles. Do not
use display-name overrides or impersonation. A credential pair that resolves to
the other App ID must fail startup rather than swap routes.

## 4. Identity values the owner must verify

- The workspace ID is the same exact immutable ID returned for both apps.
- The only accepted Slack user is Leo, immutable user ID `U0BD3523C1F`.
- The Agent Office and Foundation App IDs are present and different.
- The Agent Office and Foundation private channel IDs are present and different.
- Each app is installed in the intended workspace and invited only to its own
  fixed private channel.
- Each bot token passes `auth.test` for the intended workspace and `bots.info`
  returns its declared App ID; each app token's Socket Mode `hello` names that
  same App ID and the app token has only `connections:write`.

Names and icons are never substitutes for these immutable checks.

## 5. External secret file

The sole planned secret input path is:

```text
/home/leo/.config/agent-office/as1-slack-pilot.env
```

Required filesystem properties:

- `/home/leo/.config/agent-office` is a real owner-controlled directory, not a
  symlink, owned by the runtime UID, with mode `0700`.
- `as1-slack-pilot.env` is a regular non-symlink file, owned by the runtime UID,
  with mode `0600`.
- The file contains each template key exactly once, contains no unknown key,
  and has no comments, shell syntax, interpolation, quoting, duplicate key, or
  multiline value.
- Runtime parsing treats the file as bounded data. It must never use `source`,
  `eval`, a shell, or environment inheritance to interpret it.

Owner preparation, from the repository root, is planned as:

```sh
install -d -m 0700 /home/leo/.config/agent-office
install -m 0600 config/slack/as1-slack-pilot.env.example \
  /home/leo/.config/agent-office/as1-slack-pilot.env
```

Then edit only the external copy with an owner-controlled editor. Populate the
workspace, App, channel, bot-token, and app-token values obtained in sections 3
and 4. Leave the committed example unchanged. Never print or commit the filled
file.

## 6. Redacted validation contract

The `redacted-check` command performs **LOCAL SYNTAX validation only**. It
validates the owner-only file's type, owner, modes, no-follow/regular-file/UTF-8,
exact key set, nonempty values, immutable ID *grammar*, token *class*, two
distinct App IDs, two distinct channel IDs, per-profile token/App key mapping, the
intended workspace ID, and the approved Leo user ID. It **does NOT** perform any
live identity proof — there is no `auth.test`, `bots.info`, or Socket Mode `hello`
App-ID pairing, and no Slack connection is opened. (Those live checks are part of
the `start` command's startup identity gate, not `redacted-check`.) It must never
print a token, token prefix, token length, raw ID, file contents, Slack response
body, or reconstructable hash.

Successful output is limited to this shape — every status is scoped to local
syntax/grammar, and the result is explicitly `LOCAL_SYNTAX_PASS`, never a bare
`PASS` that would imply a network identity proof:

```text
AS1_SLACK_REDACTED_CHECK
SCOPE: LOCAL_SYNTAX_ONLY
CONFIG_FILE: VALID_OWNER_ONLY
KEY_SET: EXACT
WORKSPACE: GRAMMAR_VALID_REDACTED
LEO_USER: GRAMMAR_MATCHES_APPROVED_ID
AGENT_OFFICE_PROFILE: GRAMMAR_VALID_REDACTED
FOUNDATION_PROFILE: GRAMMAR_VALID_REDACTED
PROFILE_SEPARATION: LOCAL_DISTINCT
TOKENS: PRESENT_AND_REDACTED
LIVE_IDENTITY_PROOF: NOT_PERFORMED
RESULT: LOCAL_SYNTAX_PASS
NOTE: local syntax validation only — NOT a live identity proof (no auth.test/bots.info/Socket hello).
```

On failure, output only a stable reason code and the affected profile or field
name; never echo the rejected value. Validation failure leaves both profiles
disconnected.

## 7. Lifecycle commands

These Phase B command forms exist via the `as1:slack-pilot` CLI as committed
implementation under independent review (source that passed design review and is
being re-reviewed after a security patch, not yet accepted for a live rehearsal).
They run today but default to disconnected — they open no Slack connection on
their own, and `start` fails closed absent every gate below. Only `start` and
`redacted-check` accept the exact `--env-file <path>`; `stop`, `incident-kill`,
`status`, and the live-disabled `restart` are ZERO-operand observer verbs that
resolve only the construction-bound fixed owner state root and reject any
operand (no state-root, secret, profile, PID, signal, destination, or reason):

```sh
npm run as1:slack-pilot -- start --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
npm run as1:slack-pilot -- redacted-check --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
npm run as1:slack-pilot -- stop
npm run as1:slack-pilot -- incident-kill
npm run as1:slack-pilot -- status
npm run as1:slack-pilot -- restart
```

`start` also requires the `AS1_SLACK_STATE_ROOT` environment value to equal the
exact fixed owner state root, and requires `--env-file` to equal the committed
descriptor's secret path; it resolves the descriptor from a fixed installed
module path independent of the working directory.

Command semantics after implementation:

- `redacted-check` performs LOCAL SYNTAX validation only (section 6) without
  opening a Slack connection and without any live identity proof.
- `start` fails closed unless both profiles validate, the global kill switch is
  disengaged, the reviewed Phase A gate is present, no instance is running, and
  exactly one separately Advisor-created committed/pushed
  `As1PilotReceiveGrantV1` authority ref is fixed by the reviewed start gate.
  The grant must be unexpired at the live connection gate, select one literal
  profile, match the exact workspace/App/channel/Leo IDs and governance/
  registry/latch snapshots, bind one profile-local state root and one root/
  conversation limit, and contain no event, root timestamp, intake, pointer,
  tmux destination, lease, capability, or delivery-grant authority. With no
  exact grant ref, the default remains disconnected. The CLI cannot select a
  profile or mint/complete a grant.
- `stop` is a zero-operand observer verb. It signals the running foreground
  owner ONLY through the sealed pidfd bridge (never a numeric-PID kill), which
  drives the owner's clean drain — stop inbound acceptance, drain exact
  already-durable work to a bounded deadline, close both Socket Mode clients, and
  leave unresolved work for restart-safe replay — then proves exact owner-lock
  removal within the fixed shutdown deadline before reporting `STOPPED_CLEAN`
  (otherwise `STOP_TIMEOUT`/`NO_LIVE_OWNER`/`STALE_OR_AMBIGUOUS_OWNER`). An exact
  `TRANSPORT_ACK_RECORDED` decision may materialize locally without rechecking
  current receive-grant expiry. The drain preserves the receive-grant root
  binding and all pointer-delivery-grant/lease consumption.
- `incident-kill` is a zero-operand observer verb. It signals the owner through
  the same sealed bridge to synchronously close the incident gate and durably
  engage the irreversible global kill, then proves both owner-lock removal and
  the durable killed state before reporting `INCIDENT_KILL_ENGAGED` (otherwise a
  stable timeout/ambiguous code). It never resets a latch and never transitions
  the killed control to `DISABLED_CLEAN`.
- `restart` is LIVE-DISABLED in Phase B. This supersedes any earlier live-restart
  wording: `restart` opens no Slack connection, performs no reconnect, and simply
  reports `RESTART_LIVE_DISABLED` (see section 10). After a clean stop, only a
  new separately authorized foreground `start` may re-open the composition; any
  later manual start replays immutable journals under existing authority and
  never renews a grant/root slot, reconnects, or clears dedupe, journal, outbox,
  delivery-grant/lease/capability consumption, or failure latches.
- `status` is a zero-operand read-only observer verb. It reports process/profile
  states and stable reason codes only, never opening Web/Socket/tmux, and never
  prints configuration values, Slack payloads, or raw grant identity values.

No lifecycle command creates a Mission, pilot receive grant, post-intake
pointer-delivery grant, readiness lease, or Advisor/tmux capability; dispatches
an actor; or overrides a latch. The gateway cannot create either grant. Real
pilot start remains an Advisor-owned, separately authorized sequential action
after all preceding gates, and every later pointer attempt requires a separate
Advisor-created `As1PointerDeliveryGrantV1` after its exact intake/pointer
exists. Kill, latch, corruption, or ambiguous durable state stops both live
receive and offline materialization; expiry alone stops new receive/Socket
reopen but does not revoke an exact ACK-recorded local decision.

## 8. Owner gate evidence

Return only the following non-secret facts to the Advisor:

- both apps were created from the committed manifests;
- exact scopes/events and absence of public/interactive/DM surfaces were checked;
- both apps are installed in the same intended private workspace;
- Leo's approved immutable user ID was checked;
- App and channel IDs are pairwise distinct where required;
- each app was invited only to its fixed private channel;
- the external directory/file ownership and modes pass;
- `redacted-check` output matches section 6 (LOCAL SYNTAX validation only);
- no token or filled configuration content is included.

Owner setup does not itself authorize a connection or pilot. The Advisor records
`OWNER_SETUP_COMPLETE` only after reviewing this redacted evidence and all
required design, implementation, and independent-review gates. Owner setup does
not create either authority grant, select the live profile, or authorize tmux
delivery.

## 9. Removal and rollback

Before any live connection, rollback is deletion of the external secret file
and revocation of both app-level and bot tokens in Slack. Remove both apps from
their pilot channels or uninstall them if the pilot is abandoned. Keep the
committed non-secret Setup Pack as historical evidence unless a reviewed commit
replaces it.

Once a live connection has ever been authorized, run the `stop` command
(implemented in Phase A) before revocation. If stop is ambiguous, engage the
global kill switch, revoke both app-level tokens, and require manual
reconciliation. Rollback never edits Exact Delivery v2 history,
reuses a retired/expired/latched receive grant, pointer-delivery grant, lease,
or consumed capability, or silently clears durable evidence.

## 10. Phase B private-pilot foreground state root and lifecycle

This section is the exact owner instruction for the Phase B private pilot. It is
an operator procedure only; it authorizes no connection and activates no pilot.
The committed descriptor stays `enabled: false` / `receiveGrantRef: null` until a
separately Advisor-authorized value-only activation commit sets it.

### 10.1 Owner state root

The one approved Phase B state root is
`/home/leo/.local/state/agent-office/as1-slack-pilot`. The owner prepares it
OUTSIDE every repository with a private umask and mode `0700`, then exports the
exact literal to every closed command:

```sh
umask 077
install -d -m 0700 /home/leo/.local/state/agent-office/as1-slack-pilot
export AS1_SLACK_STATE_ROOT=/home/leo/.local/state/agent-office/as1-slack-pilot
```

The CLI requires an absolute, real, owner-UID, non-symlink root with the existing
`agent-office.state-root.v1` marker and state-root ID `as1-slack-pilot`. A
repository path, `/tmp`, a shared/group-writable directory, a symlink, a second
arbitrary root, or a relative path fails closed. No secret is stored below this
root. Only `start` and `redacted-check` read `AS1_SLACK_STATE_ROOT` and the
descriptor's exact secret path; the observer verbs resolve only the fixed
construction-bound state-root literal above and accept no operand.

### 10.2 Mutation-free capability gate

Before any state-root mutation, `start` and `redacted-check` run the pinned
`/usr/bin/python3.14` interpreter capability probe (the sealed pidfd bridge). Any
non-success maps to the single redacted code `LIFECYCLE_CAPABILITY_UNAVAILABLE`
and process exit `2`, leaving an absent state root absent and an existing root
byte-unchanged with no writer-lock residue.

### 10.3 Closed foreground start

`start` is a foreground process that holds the writer lock for its whole lifetime
and installs the clean SIGINT/SIGTERM and one fixed SIGUSR2 incident handler
before any side effect. So the writer-lock record's owner argv is exact, the live
start uses the direct five-item Node invocation (the state-root assignment is
environment, not argv), never an `npm`/shell wrapper, alternate worktree, or
relative entry:

```sh
AS1_SLACK_STATE_ROOT=/home/leo/.local/state/agent-office/as1-slack-pilot \
  /home/leo/.nvm/versions/node/v24.18.0/bin/node \
  /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001/dist/core/runtime/as1-slack-pilot/cli.js \
  start --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
```

`start` remains disconnected unless a separately authorized value-only activation
has set the descriptor `enabled: true` with exactly one committed/pushed
receive-grant ref. The CLI cannot select a profile or mint/complete a grant.

### 10.4 Zero-operand clean stop and durable incident kill

`stop` and `incident-kill` are ZERO-operand observer commands (no `--env-file`,
PID, signal, profile, path, destination, or reason). Each resolves only the fixed
owner writer lock and signals the running foreground owner through the sealed
pidfd bridge — never a numeric-PID `kill`:

```sh
node dist/core/runtime/as1-slack-pilot/cli.js stop
node dist/core/runtime/as1-slack-pilot/cli.js incident-kill
```

- `stop` sends the clean SIGTERM through one Linux pidfd, then waits the fixed
  `10,000 ms` deadline for the exact lock inode to disappear, returning only
  `STOPPED_CLEAN`, `STALE_OR_AMBIGUOUS_OWNER`, `NO_LIVE_OWNER`, or `STOP_TIMEOUT`.
- `incident-kill` sends the fixed SIGUSR2 through one Linux pidfd. The owner
  synchronously closes every admission gate, durably engages the irreversible
  global kill (`OPERATOR_INCIDENT_KILL`, `DISABLED_LATCHED`), then bounded-shuts
  down. It returns only `INCIDENT_KILL_ENGAGED`, `INCIDENT_KILL_ALREADY_ENGAGED`,
  `STALE_OR_AMBIGUOUS_OWNER`, `NO_LIVE_OWNER`, `INCIDENT_KILL_PERSIST_FAILED`, or
  `INCIDENT_KILL_TIMEOUT`. A durable latch has no reset or startup auto-recovery.

`status` is read-only and prints only stable state/reason codes — never an ID,
path, grant value, token fact, Slack response, or tmux coordinate. `restart` is
live-disabled: it fails closed without opening Web/Socket/tmux. Only a separately
issued foreground `start` may begin either private pilot.

### 10.5 Sequential two-pilot rule

Exactly one profile is live at a time. Run the Agent Office pilot, then stop and
audit it, before a new value-only activation names the Foundation receive grant
and its pilot runs. A failure in one pilot never authorizes switching to the
other. There is no automatic restart, reconnect, or rollover.
