# AS1 Multi-Team Slack Pilot Setup

Status: `SETUP_PACK_ONLY__RUNTIME_COMMANDS_NOT_YET_AVAILABLE`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

This is the non-secret owner Setup Pack for two private Slack Socket Mode apps.
It does not create a pilot receive grant, activate a client, connect to Slack,
create pointer-delivery authority or a runtime capability, start Agent Office,
or authorize a real pilot. The commands in section 7 are a Phase A contract and
remain unavailable until Phase A implementation lands. Even after they exist,
live connection remains disabled until independent implementation/security
review passes, the Advisor records the owner gate, and the Advisor supplies one
exact committed/pushed unexpired `As1PilotReceiveGrantV1` for one profile.

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

The future redacted check must validate file type, owner, modes, exact key set,
nonempty values, immutable ID syntax, token class, two distinct App IDs, two
distinct channel IDs, `auth.test` workspace/bot identity, `bots.info` App ID,
Socket Mode `hello` App ID, per-profile token/App identity, intended workspace,
and the approved Leo user ID. It must never print a token, token prefix, token
length, raw ID, file contents, Slack response body, or reconstructable hash.

Successful output is limited to this shape:

```text
AS1_SLACK_REDACTED_CHECK
CONFIG_FILE: VALID_OWNER_ONLY
KEY_SET: EXACT
WORKSPACE: VERIFIED_REDACTED
LEO_USER: VERIFIED_APPROVED_ID
AGENT_OFFICE_PROFILE: VERIFIED_REDACTED
FOUNDATION_PROFILE: VERIFIED_REDACTED
PROFILE_SEPARATION: VERIFIED
TOKENS: PRESENT_AND_REDACTED
LIVE_CONNECTION: NOT_STARTED
RESULT: PASS
```

On failure, output only a stable reason code and the affected profile or field
name; never echo the rejected value. Validation failure leaves both profiles
disconnected.

## 7. Planned lifecycle commands

These exact command forms are design inputs for the Worker. They do not exist in
the Setup Pack and must not be run until Phase A implementation lands:

```sh
npm run as1:slack-pilot -- start --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
npm run as1:slack-pilot -- stop --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
npm run as1:slack-pilot -- restart --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
npm run as1:slack-pilot -- status --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
npm run as1:slack-pilot -- redacted-check --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
```

Command semantics after implementation:

- `redacted-check` performs validation without opening a Slack connection.
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
- `stop` stops inbound acceptance, drains exact already-durable work to a
  bounded deadline, closes both Socket Mode clients, and leaves unresolved work
  for restart-safe replay. An exact `TRANSPORT_ACK_RECORDED` decision may
  materialize locally without rechecking current receive-grant expiry. Stop
  preserves the receive-grant root binding and all pointer-delivery-grant/lease
  consumption.
- `restart` performs a successful clean `stop`, exact state recovery, and then
  evaluates the fresh live-start gate. Only the same still-unexpired receive
  grant may reauthenticate and reopen its Socket. If that grant is expired,
  restart must remain disconnected but may run a bounded offline drain that
  materializes each exact `TRANSPORT_ACK_RECORDED` decision once; it cannot
  bind/consume new receive state. This local drain is not grant renewal or
  reuse. Restart never renews a grant/root slot or clears dedupe, journal,
  outbox, delivery-grant/lease/capability consumption, or failure latches.
- `status` reports process/profile states and stable reason codes only. It never
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
- `redacted-check` output, once implemented, matches section 6;
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

After Phase A exists, run the planned `stop` command before revocation. If stop
is ambiguous, engage the global kill switch, revoke both app-level tokens, and
require manual reconciliation. Rollback never edits Exact Delivery v2 history,
reuses a retired/expired/latched receive grant, pointer-delivery grant, lease,
or consumed capability, or silently clears durable evidence.
