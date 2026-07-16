// AS1 Multi-Team Slack Pilot — single-process writer lock with a retained close-on-exec descriptor and the
// sealed, byte-identified Python pidfd bridge for capability/clean-stop/incident-kill (design §11.1).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md §11.1 and
// docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md. The `agent-office.writer-lock.v1` record,
// keys, canonical-plus-LF bytes, and path are UNCHANGED from Phase A. Phase B adds three things and nothing
// else: (1) the foreground owner RETAINS the exact O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW descriptor that created
// the lock and proves it is close-on-exec via /proc/self/fdinfo; (2) a mutation-free `CAPABILITY_PROBE` that
// verifies the exact `/usr/bin/python3.14` object, hashes and pins its no-follow-opened FD, executes that same
// FD as child `/proc/self/fd/3`, and checks pidfd APIs BEFORE any state-root mutation; (3) `CLEAN_STOP` and
// `INCIDENT_KILL`, whose seven signal-request keys the TypeScript boundary derives from a private no-follow
// observation of the construction-bound owner-UID one-link lock and its `/proc/<pid>/stat` — never a caller —
// and which observe the exact owner twice through ONE Linux pidfd and send only the fixed signal through that
// same incarnation. No source, module, executable, path, PID, signal, profile, state root, reason, or argv
// comes from CLI input or a public reusable API.
import { constants } from 'node:fs';
import { link, lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import { canonicalBytes, canonicalize } from './canonical-json.js';
import { StoreError } from './errors.js';
import {
  FILE_MODE,
  ensurePrivateDirectory,
  fsyncDirectory,
  isNodeError,
  readStateRootFormat,
  validateStateRoot,
} from './path-safety.js';
import { sha256Bytes } from './hashing.js';
import { writeAtomicCanonicalJson } from './atomic-file.js';

// ── Exact interpreter object (design §11.1.1) — acceptance constants, never runtime-updatable ────────────────
/** The ONLY accepted interpreter pathname. */
export const AS1_INTERPRETER_PATH = '/usr/bin/python3.14';
const INTERPRETER_UID = 0;
const INTERPRETER_GID = 0;
const INTERPRETER_MODE = 0o755;
const INTERPRETER_NLINK = 1;
const INTERPRETER_DEVICE = 2049;
const INTERPRETER_INODE = 14_996;
const INTERPRETER_SIZE = 7_481_192;
const INTERPRETER_SHA256 = 'sha256:b8d8288faefdd300201f43fcf00f6f539a27218eeed3a3dff5ab10b9c4c99700';
const INTERPRETER_VERSION = '3.14.4';
/** Reject byte 8,388,609: cap the interpreter hash read at exactly 8 MiB (the interpreter is < 8 MiB). */
const INTERPRETER_READ_CAP = 8 * 1024 * 1024;
const HASH_CHUNK_BYTES = 64 * 1024;

// ── Exact bridge protocol identity + bounds (design §11.1.2) ────────────────────────────────────────────────
const BRIDGE_REQUEST_SCHEMA = 'agent-office.as1-pidfd-bridge-request.v1';
const BRIDGE_RESULT_SCHEMA = 'agent-office.as1-pidfd-bridge-result.v1';
/** The complete child environment: exactly two entries, inheriting none. */
const BRIDGE_ENV: Readonly<Record<string, string>> = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
/** The fixed proc-fd pathname the child execs — it resolves the verified inherited interpreter file description. */
const AS1_PROC_SELF_FD_3 = '/proc/self/fd/3';
/**
 * The exact construction-bound owner writer-lock path (design §5.1/§11.1) — the SAME `LOCK_PATH` the sealed
 * literal hardcodes. The production observer signal boundary uses ONLY this fixed path; no caller-selected lock
 * path exists at the production surface (F05).
 */
export const AS1_FIXED_OWNER_LOCK_PATH = '/home/leo/.local/state/agent-office/as1-slack-pilot/locks/writer.lock';
/** Linux `O_CLOEXEC` (0o2000000) — Node opens every fd close-on-exec; this value is only used to VERIFY the bit. */
const LINUX_O_CLOEXEC = 0o2_000_000;
/** The fixed owner-shutdown deadline the observer CLI waits for lock removal after a same-pidfd send (§11.1.2). */
export const AS1_OWNER_SHUTDOWN_DEADLINE_MS = 10_000;
const REQUEST_MAX_BYTES = 8_191;
const STDIN_MAX_BYTES = 8_192;
const RESPONSE_MAX_BYTES = 511;
const STDOUT_MAX_BYTES = 512;
const STDERR_CAP_BYTES = 512;
/** Deadlines (design §11.1.2): pre-spawn verifier, direct-child, and total operation (owner shutdown is exported). */
const PRE_SPAWN_DEADLINE_MS = 1_000;
const CHILD_DEADLINE_MS = 2_000;
const TOTAL_OPERATION_DEADLINE_MS = 3_000;

/** The three closed bridge operations. No other operation, signal, or reset surface is representable. */
export const AS1_BRIDGE_OPERATIONS = ['CAPABILITY_PROBE', 'CLEAN_STOP', 'INCIDENT_KILL'] as const;
export type As1BridgeOperation = (typeof AS1_BRIDGE_OPERATIONS)[number];

/** The exhaustive redacted bridge outcomes and their fixed exit codes (design §11.1.2). */
export const AS1_BRIDGE_OUTCOME_EXITS: Readonly<Record<string, number>> = {
  CAPABILITY_READY: 0,
  SIGNAL_SENT: 0,
  REQUEST_REJECTED: 64,
  CAPABILITY_UNAVAILABLE: 65,
  OWNER_MISMATCH: 66,
  OWNER_EXITED: 67,
  SIGNAL_REJECTED: 68,
  BRIDGE_TIMEOUT: 69,
  INTERNAL_ERROR: 70,
};

/** A single bridge run result. `ok` is true only for the exact success outcome of the requested operation. */
export interface As1BridgeResult {
  readonly ok: boolean;
  readonly operation: string;
  /** A stable redacted outcome code — never bridge bytes, PID, signal, path, or token facts. */
  readonly outcome: string;
  readonly exitCode: number | null;
}

const PIDFD_BRIDGE_SOURCE = String.raw`import datetime
import errno
import hashlib
import json
import os
import re
import select
import signal
import stat
import sys

EXPECTED_PYTHON_VERSION = "3.14.4"
EXPECTED_ENVIRONMENT = {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"}
EXPECTED_INTERPRETER_DEVICE = 2049
EXPECTED_INTERPRETER_INODE = 14996
EXPECTED_INTERPRETER_MODE = 0o755
EXPECTED_INTERPRETER_SIZE = 7481192
EXPECTED_OWNER_UID = 1000
EXPECTED_OWNER_EXECUTABLE = "/home/leo/.nvm/versions/node/v24.18.0/bin/node"
EXPECTED_OWNER_EXECUTABLE_DEVICE = 2049
EXPECTED_OWNER_EXECUTABLE_INODE = 397924
EXPECTED_OWNER_ARGV = (
    "/home/leo/.nvm/versions/node/v24.18.0/bin/node",
    "/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001/dist/core/runtime/as1-slack-pilot/cli.js",
    "start",
    "--env-file",
    "/home/leo/.config/agent-office/as1-slack-pilot.env",
)
LOCK_PATH = "/home/leo/.local/state/agent-office/as1-slack-pilot/locks/writer.lock"
EXPECTED_LOCK_KEYS = frozenset((
    "acquiredAt", "bootId", "buildId", "ownershipToken", "pid",
    "schemaVersion", "stateRootId",
))
CAPABILITY_REQUEST_KEYS = frozenset(("operation", "schemaVersion"))
SIGNAL_REQUEST_KEYS = frozenset((
    "expectedLockDevice", "expectedLockInode", "expectedLockSha256",
    "expectedOwnerPid", "expectedOwnerStartTicks", "operation", "schemaVersion",
))
REQUEST_SCHEMA = "agent-office.as1-pidfd-bridge-request.v1"
RESULT_SCHEMA = "agent-office.as1-pidfd-bridge-result.v1"
OPERATIONS = frozenset(("CAPABILITY_PROBE", "CLEAN_STOP", "INCIDENT_KILL"))
SIGNALS = {"CLEAN_STOP": signal.SIGTERM, "INCIDENT_KILL": signal.SIGUSR2}
STDIN_MAX_BYTES = 8192
REQUEST_MAX_BYTES = 8191
STDOUT_MAX_BYTES = 512
RESPONSE_MAX_BYTES = 511
LOCK_MAX_BYTES = 4096
BOOT_ID_MAX_BYTES = 64
STAT_MAX_BYTES = 4096
STATUS_MAX_BYTES = 16384
CMDLINE_MAX_BYTES = 8192
FDINFO_MAX_BYTES = 4096
PROC_LINK_MAX_BYTES = 4096
FD_ENTRY_MAX_COUNT = 4096
INTERNAL_DEADLINE_SECONDS = 1.5

class RequestRejected(Exception):
    pass

class CapabilityUnavailable(Exception):
    pass

class OwnerMismatch(Exception):
    pass

class OwnerExited(Exception):
    pass

class SignalRejected(Exception):
    pass

class BridgeDeadline(Exception):
    pass

def _raise(error_type):
    raise error_type()

def _on_deadline(_signum, _frame):
    raise BridgeDeadline()

def _read_fd(fd, limit, error_type):
    data = bytearray()
    while True:
        chunk = os.read(fd, min(4096, limit + 1 - len(data)))
        if not chunk:
            return bytes(data)
        data.extend(chunk)
        if len(data) > limit:
            raise error_type()

def _read_regular_path(path, limit, error_type):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise error_type()
            return _read_fd(fd, limit, error_type)
        finally:
            os.close(fd)
    except error_type:
        raise
    except OSError:
        raise error_type() from None

def _decode_canonical_line(raw, payload_limit, error_type):
    if not raw or len(raw) > payload_limit + 1 or raw[-1:] != b"\n":
        raise error_type()
    payload = raw[:-1]
    if not payload or len(payload) > payload_limit:
        raise error_type()
    def unique_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise error_type()
            value[key] = item
        return value
    try:
        text = payload.decode("utf-8", "strict")
        value = json.loads(
            text,
            object_pairs_hook=unique_object,
            parse_constant=lambda _value: _raise(error_type),
        )
        canonical = json.dumps(
            value, ensure_ascii=True, sort_keys=True, separators=(",", ":")
        ).encode("ascii")
    except error_type:
        raise
    except (UnicodeError, ValueError, TypeError):
        raise error_type() from None
    if canonical != payload:
        raise error_type()
    return value

def _decimal_string(value):
    if type(value) is not str or re.fullmatch(r"(?:0|[1-9][0-9]{0,19})", value) is None:
        raise RequestRejected()
    number = int(value, 10)
    if number > 18446744073709551615:
        raise RequestRejected()
    return number

def _validate_request(value):
    if type(value) is not dict:
        raise RequestRejected()
    operation = value.get("operation")
    if type(operation) is not str or operation not in OPERATIONS:
        raise RequestRejected()
    expected_keys = CAPABILITY_REQUEST_KEYS if operation == "CAPABILITY_PROBE" else SIGNAL_REQUEST_KEYS
    if frozenset(value) != expected_keys or value.get("schemaVersion") != REQUEST_SCHEMA:
        raise RequestRejected()
    if operation != "CAPABILITY_PROBE":
        digest = value["expectedLockSha256"]
        if type(digest) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is None:
            raise RequestRejected()
        _decimal_string(value["expectedLockDevice"])
        _decimal_string(value["expectedLockInode"])
        _decimal_string(value["expectedOwnerStartTicks"])
        pid = value["expectedOwnerPid"]
        if type(pid) is not int or not 1 <= pid <= 4194304:
            raise RequestRejected()
    return value

def _read_request():
    raw = _read_fd(0, STDIN_MAX_BYTES, RequestRejected)
    value = _decode_canonical_line(raw, REQUEST_MAX_BYTES, RequestRejected)
    return _validate_request(value)

def _emit(operation, outcome, success):
    value = {"operation": operation, "outcome": outcome, "schemaVersion": RESULT_SCHEMA}
    if success:
        value["pythonVersion"] = EXPECTED_PYTHON_VERSION
    payload = json.dumps(
        value, ensure_ascii=True, sort_keys=True, separators=(",", ":")
    ).encode("ascii")
    if len(payload) > RESPONSE_MAX_BYTES or len(payload) + 1 > STDOUT_MAX_BYTES:
        raise RuntimeError()
    output = payload + b"\n"
    offset = 0
    while offset < len(output):
        offset += os.write(1, output[offset:])

def _check_runtime():
    if sys.executable != "/proc/self/fd/3":
        raise CapabilityUnavailable()
    if sys.version_info[:3] != (3, 14, 4):
        raise CapabilityUnavailable()
    flags = sys.flags
    if not (flags.isolated == 1 and flags.no_site == 1 and
            flags.ignore_environment == 1 and flags.safe_path):
        raise CapabilityUnavailable()
    if dict(os.environ) != EXPECTED_ENVIRONMENT:
        raise CapabilityUnavailable()
    try:
        interpreter = os.fstat(3)
    except OSError:
        raise CapabilityUnavailable() from None
    if not (
        stat.S_ISREG(interpreter.st_mode)
        and interpreter.st_uid == 0
        and interpreter.st_gid == 0
        and stat.S_IMODE(interpreter.st_mode) == EXPECTED_INTERPRETER_MODE
        and interpreter.st_nlink == 1
        and interpreter.st_dev == EXPECTED_INTERPRETER_DEVICE
        and interpreter.st_ino == EXPECTED_INTERPRETER_INODE
        and interpreter.st_size == EXPECTED_INTERPRETER_SIZE
        and callable(getattr(os, "pidfd_open", None))
        and callable(getattr(signal, "pidfd_send_signal", None))
        and hasattr(select, "poll")
        and callable(getattr(signal, "setitimer", None))
    ):
        raise CapabilityUnavailable()

def _pidfd_is_live(pidfd, pid, error_type):
    raw = _read_regular_path(f"/proc/self/fdinfo/{pidfd}", FDINFO_MAX_BYTES, error_type)
    pid_values = []
    try:
        for line in raw.decode("ascii", "strict").splitlines():
            if line.startswith("Pid:"):
                pid_values.append(int(line.split(":", 1)[1].strip(), 10))
    except (UnicodeError, ValueError):
        raise error_type() from None
    if pid_values != [pid]:
        raise error_type()
    poller = select.poll()
    poller.register(pidfd, select.POLLIN | select.POLLHUP | select.POLLERR)
    if poller.poll(0):
        raise OwnerExited()

def _capability_probe():
    try:
        pidfd = os.pidfd_open(os.getpid(), 0)
    except OSError:
        raise CapabilityUnavailable() from None
    try:
        _pidfd_is_live(pidfd, os.getpid(), CapabilityUnavailable)
    finally:
        os.close(pidfd)

def _read_boot_id():
    raw = _read_regular_path(
        "/proc/sys/kernel/random/boot_id", BOOT_ID_MAX_BYTES, OwnerMismatch
    )
    if len(raw) != 37 or raw[-1:] != b"\n":
        raise OwnerMismatch()
    try:
        value = raw[:-1].decode("ascii", "strict")
    except UnicodeError:
        raise OwnerMismatch() from None
    if re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", value
    ) is None:
        raise OwnerMismatch()
    return value

def _read_lock(request):
    try:
        fd = os.open(
            LOCK_PATH, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
        )
        try:
            lock_stat = os.fstat(fd)
            raw = _read_fd(fd, LOCK_MAX_BYTES, OwnerMismatch)
        finally:
            os.close(fd)
    except OwnerMismatch:
        raise
    except FileNotFoundError:
        raise OwnerExited() from None
    except OSError:
        raise OwnerMismatch() from None
    if not (
        stat.S_ISREG(lock_stat.st_mode)
        and lock_stat.st_uid == EXPECTED_OWNER_UID
        and stat.S_IMODE(lock_stat.st_mode) == 0o600
        and lock_stat.st_nlink == 1
        and str(lock_stat.st_dev) == request["expectedLockDevice"]
        and str(lock_stat.st_ino) == request["expectedLockInode"]
    ):
        raise OwnerMismatch()
    digest = "sha256:" + hashlib.sha256(raw).hexdigest()
    if digest != request["expectedLockSha256"]:
        raise OwnerMismatch()
    value = _decode_canonical_line(raw, LOCK_MAX_BYTES - 1, OwnerMismatch)
    if type(value) is not dict or frozenset(value) != EXPECTED_LOCK_KEYS:
        raise OwnerMismatch()
    if not (
        value["schemaVersion"] == "agent-office.writer-lock.v1"
        and type(value["pid"]) is int
        and value["pid"] == request["expectedOwnerPid"]
        and value["bootId"] == _read_boot_id()
        and value["buildId"] == "as1-slack-pilot"
        and value["stateRootId"] == "as1-slack-pilot"
        and type(value["ownershipToken"]) is str
        and re.fullmatch(r"[0-9a-f]{64}", value["ownershipToken"]) is not None
        and type(value["acquiredAt"]) is str
        and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z", value["acquiredAt"]) is not None
    ):
        raise OwnerMismatch()
    try:
        datetime.datetime.strptime(value["acquiredAt"], "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        raise OwnerMismatch() from None
    return (digest, lock_stat.st_dev, lock_stat.st_ino, value["bootId"])

def _read_process_stat(pid, expected_start_ticks):
    raw = _read_regular_path(f"/proc/{pid}/stat", STAT_MAX_BYTES, OwnerMismatch)
    try:
        text = raw.decode("ascii", "strict").strip()
        right = text.rfind(")")
        if not text.startswith(f"{pid} (") or right < 0 or text[right + 1:right + 2] != " ":
            raise OwnerMismatch()
        fields = text[right + 2:].split()
        if len(fields) < 20 or fields[0] in ("Z", "X", "x"):
            raise OwnerExited()
        start_ticks = fields[19]
    except (UnicodeError, IndexError):
        raise OwnerMismatch() from None
    if re.fullmatch(r"(?:0|[1-9][0-9]{0,19})", start_ticks) is None:
        raise OwnerMismatch()
    if start_ticks != expected_start_ticks:
        raise OwnerMismatch()
    return start_ticks

def _read_process_uids(pid):
    raw = _read_regular_path(f"/proc/{pid}/status", STATUS_MAX_BYTES, OwnerMismatch)
    uid_lines = []
    try:
        for line in raw.decode("ascii", "strict").splitlines():
            if line.startswith("Uid:"):
                uid_lines.append(tuple(int(item, 10) for item in line[4:].split()))
    except (UnicodeError, ValueError):
        raise OwnerMismatch() from None
    if uid_lines != [(EXPECTED_OWNER_UID,) * 4]:
        raise OwnerMismatch()
    return uid_lines[0]

def _read_process_executable(pid):
    path = f"/proc/{pid}/exe"
    try:
        target = os.readlink(path)
        target_bytes = os.fsencode(target)
        executable = os.stat(path, follow_symlinks=True)
    except OSError:
        raise OwnerMismatch() from None
    if not (
        0 < len(target_bytes) <= PROC_LINK_MAX_BYTES
        and target == EXPECTED_OWNER_EXECUTABLE
        and stat.S_ISREG(executable.st_mode)
        and executable.st_dev == EXPECTED_OWNER_EXECUTABLE_DEVICE
        and executable.st_ino == EXPECTED_OWNER_EXECUTABLE_INODE
    ):
        raise OwnerMismatch()
    return (target, executable.st_dev, executable.st_ino)

def _read_process_argv(pid):
    raw = _read_regular_path(f"/proc/{pid}/cmdline", CMDLINE_MAX_BYTES, OwnerMismatch)
    if not raw or raw[-1:] != b"\0":
        raise OwnerMismatch()
    try:
        argv = tuple(item.decode("ascii", "strict") for item in raw[:-1].split(b"\0"))
    except UnicodeError:
        raise OwnerMismatch() from None
    if argv != EXPECTED_OWNER_ARGV:
        raise OwnerMismatch()
    return argv

def _read_retained_lock_fd(pid, lock_device, lock_inode):
    matches = []
    count = 0
    try:
        with os.scandir(f"/proc/{pid}/fd") as entries:
            for entry in entries:
                count += 1
                if count > FD_ENTRY_MAX_COUNT:
                    raise OwnerMismatch()
                if re.fullmatch(r"[0-9]+", entry.name) is None:
                    continue
                try:
                    target_stat = entry.stat(follow_symlinks=True)
                except FileNotFoundError:
                    continue
                if target_stat.st_dev != lock_device or target_stat.st_ino != lock_inode:
                    continue
                raw = _read_regular_path(
                    f"/proc/{pid}/fdinfo/{entry.name}", FDINFO_MAX_BYTES, OwnerMismatch
                )
                flag_values = []
                try:
                    for line in raw.decode("ascii", "strict").splitlines():
                        if line.startswith("flags:"):
                            flag_values.append(int(line.split(":", 1)[1].strip(), 8))
                except (UnicodeError, ValueError):
                    raise OwnerMismatch() from None
                if len(flag_values) != 1:
                    raise OwnerMismatch()
                flags = flag_values[0]
                if not (
                    flags & os.O_ACCMODE == os.O_WRONLY
                    and flags & os.O_CLOEXEC == os.O_CLOEXEC
                    and flags & os.O_NOFOLLOW == os.O_NOFOLLOW
                ):
                    raise OwnerMismatch()
                matches.append((int(entry.name, 10), flags))
    except OwnerMismatch:
        raise
    except FileNotFoundError:
        raise OwnerExited() from None
    except OSError:
        raise OwnerMismatch() from None
    if len(matches) != 1:
        raise OwnerMismatch()
    return matches[0]

def _observe(request, pidfd):
    pid = request["expectedOwnerPid"]
    _pidfd_is_live(pidfd, pid, OwnerMismatch)
    lock = _read_lock(request)
    start_ticks = _read_process_stat(pid, request["expectedOwnerStartTicks"])
    uids = _read_process_uids(pid)
    executable = _read_process_executable(pid)
    argv = _read_process_argv(pid)
    retained_fd = _read_retained_lock_fd(pid, lock[1], lock[2])
    _pidfd_is_live(pidfd, pid, OwnerMismatch)
    return (lock, pid, start_ticks, uids, executable, argv, retained_fd)

def _send_fixed_signal(request):
    if os.getuid() != EXPECTED_OWNER_UID:
        raise OwnerMismatch()
    pid = request["expectedOwnerPid"]
    try:
        pidfd = os.pidfd_open(pid, 0)
    except ProcessLookupError:
        raise OwnerExited() from None
    except OSError:
        raise OwnerMismatch() from None
    try:
        _pidfd_is_live(pidfd, pid, OwnerMismatch)
        first = _observe(request, pidfd)
        second = _observe(request, pidfd)
        if second != first:
            raise OwnerMismatch()
        _pidfd_is_live(pidfd, pid, OwnerMismatch)
        try:
            signal.pidfd_send_signal(pidfd, SIGNALS[request["operation"]], None, 0)
        except ProcessLookupError:
            raise OwnerExited() from None
        except OSError as error:
            if error.errno == errno.ESRCH:
                raise OwnerExited() from None
            raise SignalRejected() from None
    finally:
        os.close(pidfd)

def _run():
    operation = "UNPARSED"
    timer_armed = False
    try:
        if not callable(getattr(signal, "setitimer", None)):
            raise CapabilityUnavailable()
        signal.signal(signal.SIGALRM, _on_deadline)
        signal.setitimer(signal.ITIMER_REAL, INTERNAL_DEADLINE_SECONDS)
        timer_armed = True
        request = _read_request()
        operation = request["operation"]
        _check_runtime()
        if operation == "CAPABILITY_PROBE":
            _capability_probe()
            _emit(operation, "CAPABILITY_READY", True)
        else:
            _send_fixed_signal(request)
            _emit(operation, "SIGNAL_SENT", True)
        return 0
    except RequestRejected:
        _emit("UNPARSED", "REQUEST_REJECTED", False)
        return 64
    except CapabilityUnavailable:
        _emit(operation, "CAPABILITY_UNAVAILABLE", False)
        return 65
    except OwnerMismatch:
        _emit(operation, "OWNER_MISMATCH", False)
        return 66
    except OwnerExited:
        _emit(operation, "OWNER_EXITED", False)
        return 67
    except SignalRejected:
        _emit(operation, "SIGNAL_REJECTED", False)
        return 68
    except BridgeDeadline:
        _emit(operation, "BRIDGE_TIMEOUT", False)
        return 69
    except BaseException:
        _emit(operation, "INTERNAL_ERROR", False)
        return 70
    finally:
        if timer_armed:
            try:
                signal.setitimer(signal.ITIMER_REAL, 0.0)
            except BaseException:
                pass

raise SystemExit(_run())
`;

const PIDFD_BRIDGE_SOURCE_BYTES = 17_983;
const PIDFD_BRIDGE_SOURCE_SHA256 = 'sha256:557e32a2ab54beea3b3ec8ce1a68bb69a7f3b756db4e3b007d18a452f7a22d75';

/**
 * Before every spawn, TypeScript requires the exact UTF-8 length and SHA-256 of the embedded literal so a
 * build-time escape, newline, or source edit fails before child creation (design §11.1.1).
 */
function assertBridgeLiteralIdentity(): void {
  if (Buffer.byteLength(PIDFD_BRIDGE_SOURCE, 'utf8') !== PIDFD_BRIDGE_SOURCE_BYTES) {
    throw new StoreError('IO_DURABILITY_FAILED', 'pidfd bridge literal byte-length drift');
  }
  if (sha256Bytes(Buffer.from(PIDFD_BRIDGE_SOURCE, 'utf8')) !== PIDFD_BRIDGE_SOURCE_SHA256) {
    throw new StoreError('IO_DURABILITY_FAILED', 'pidfd bridge literal SHA-256 drift');
  }
}

/** Internal control-flow signal that maps a pre-spawn/parse failure to a fixed redacted bridge outcome. */
class BridgeFailure extends Error {
  public constructor(public readonly outcome: string) {
    super(outcome);
    this.name = 'BridgeFailure';
  }
}

interface VerifiedInterpreter {
  readonly handle: import('node:fs/promises').FileHandle;
  readonly fd: number;
}

/**
 * Verify and open the exact interpreter object, then keep the descriptor for per-use FD-3 execution
 * (design §11.1.1 steps 1–3). realpath/lstat/open-once/exact-fstat-tuple/hash-through-EOF/re-lstat-identity all
 * complete before the caller may spawn; any drift or elapsed pre-spawn deadline fails before child creation.
 */
async function verifyAndOpenInterpreter(deadlineMonoMs: number): Promise<VerifiedInterpreter> {
  // F05: the MONOTONIC pre-spawn deadline is checked at every async step — realpath/lstat/open/fstat/hash/re-lstat
  // can each overrun, and the final check happens immediately before returning (the caller then spawns).
  const overrun = (): boolean => performance.now() > deadlineMonoMs;
  if (overrun()) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
  const resolved = await realpath(AS1_INTERPRETER_PATH);
  if (resolved !== AS1_INTERPRETER_PATH || overrun()) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
  const pre = await lstat(AS1_INTERPRETER_PATH);
  if (pre.isSymbolicLink() || !pre.isFile() || overrun()) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
  const handle = await open(
    AS1_INTERPRETER_PATH,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK | LINUX_O_CLOEXEC,
  );
  try {
    if (overrun()) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
    const st = await handle.stat();
    if (
      !st.isFile() ||
      st.uid !== INTERPRETER_UID ||
      st.gid !== INTERPRETER_GID ||
      (st.mode & 0o7777) !== INTERPRETER_MODE ||
      st.nlink !== INTERPRETER_NLINK ||
      st.dev !== INTERPRETER_DEVICE ||
      st.ino !== INTERPRETER_INODE ||
      st.size !== INTERPRETER_SIZE ||
      overrun()
    ) {
      throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
    }
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(HASH_CHUNK_BYTES);
    let total = 0;
    for (;;) {
      if (overrun()) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
      const { bytesRead } = await handle.read(buffer, 0, HASH_CHUNK_BYTES, total);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > INTERPRETER_READ_CAP) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
      hash.update(buffer.subarray(0, bytesRead));
    }
    if (total !== INTERPRETER_SIZE) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
    if (`sha256:${hash.digest('hex')}` !== INTERPRETER_SHA256) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
    // Immediately before spawn, re-lstat the fixed pathname and require its device/inode to equal the open FD.
    const post = await lstat(AS1_INTERPRETER_PATH);
    if (post.dev !== st.dev || post.ino !== st.ino || overrun()) throw new BridgeFailure('CAPABILITY_UNAVAILABLE');
    return { handle, fd: handle.fd };
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

/** The raw child output the bridge decoder consumes. Exported so deterministic tests can inject a child runner. */
export interface As1BridgeChildOutput {
  readonly stdout: Buffer;
  readonly stderrBytes: number;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly overflow: boolean;
}

/**
 * Test-only bridge injection seams (F05): a fake child runner (to exercise the strict result decoder without the
 * real interpreter) and a monotonic clock (to exercise the whole-operation deadline). NEVER used in production —
 * the CLI/composition call `probeCapability()`/`signalFixedOwner()` with no options, so the real verified spawn runs.
 */
export interface As1BridgeRunOptions {
  readonly childRunner?: (requestBytes: Buffer) => Promise<As1BridgeChildOutput>;
  readonly nowMs?: () => number;
}

/**
 * Spawn the verified interpreter as `/proc/self/fd/3` with the exact argv/env/stdio, write one canonical
 * request + LF to closed stdin, and drain stdout/stderr under the fixed caps and the direct-child deadline.
 * A byte 513 from either pipe or the elapsed child deadline SIGKILLs the direct child (never the owner).
 */
function runVerifiedChild(fd: number, requestBytes: Buffer): Promise<As1BridgeChildOutput> {
  return new Promise<As1BridgeChildOutput>((resolve) => {
    const child = spawn(AS1_PROC_SELF_FD_3, ['-I', '-S', '-c', PIDFD_BRIDGE_SOURCE], {
      cwd: '/',
      env: { ...BRIDGE_ENV },
      stdio: ['pipe', 'pipe', 'pipe', fd],
    });
    const stdoutChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let overflow = false;
    let timedOut = false;
    let settled = false;
    const killChild = (): void => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* the direct child is already gone */
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killChild();
    }, CHILD_DEADLINE_MS);
    const finish = (output: Omit<As1BridgeChildOutput, 'timedOut' | 'overflow'>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...output, timedOut, overflow });
    };
    const { stdin, stdout, stderr } = child;
    if (stdin === null || stdout === null || stderr === null) {
      finish({ stdout: Buffer.alloc(0), stderrBytes: 0, code: null, signal: null });
      return;
    }
    child.on('error', () => {
      finish({ stdout: Buffer.concat(stdoutChunks), stderrBytes, code: null, signal: null });
    });
    stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > STDOUT_MAX_BYTES) {
        overflow = true;
        killChild();
        return;
      }
      stdoutChunks.push(chunk);
    });
    stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > STDERR_CAP_BYTES) {
        overflow = true;
        killChild();
      }
    });
    child.on('close', (code, signal) => {
      finish({ stdout: Buffer.concat(stdoutChunks), stderrBytes, code, signal });
    });
    stdout.on('error', () => undefined);
    stderr.on('error', () => undefined);
    stdin.on('error', () => undefined);
    stdin.end(requestBytes);
  });
}

/** Parse and validate the bridge's single canonical result line for the requested operation. */
function parseBridgeResult(operation: As1BridgeOperation, output: As1BridgeChildOutput): As1BridgeResult {
  if (output.timedOut) return { ok: false, operation, outcome: 'BRIDGE_TIMEOUT', exitCode: output.code };
  if (output.overflow) return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  if (output.signal !== null) return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: null };
  if (output.stderrBytes !== 0) return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  const bytes = output.stdout;
  if (bytes.byteLength === 0 || bytes.byteLength > STDOUT_MAX_BYTES || bytes[bytes.byteLength - 1] !== 0x0a) {
    return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  }
  const payload = bytes.subarray(0, bytes.byteLength - 1);
  if (payload.byteLength > RESPONSE_MAX_BYTES) return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  let value: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    value = JSON.parse(text);
    if (canonicalize(value) !== text) throw new Error('noncanonical result bytes');
  } catch {
    return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== BRIDGE_RESULT_SCHEMA || typeof record.outcome !== 'string') {
    return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  }
  const outcome = record.outcome;
  const expectedExit = AS1_BRIDGE_OUTCOME_EXITS[outcome];
  if (expectedExit === undefined || output.code !== expectedExit) {
    return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  }
  const successOutcome = operation === 'CAPABILITY_PROBE' ? 'CAPABILITY_READY' : 'SIGNAL_SENT';
  if (outcome === successOutcome) {
    const keys = Object.keys(record).sort();
    if (
      keys.length !== 4 ||
      record.operation !== operation ||
      record.pythonVersion !== INTERPRETER_VERSION ||
      output.code !== 0
    ) {
      return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
    }
    return { ok: true, operation, outcome, exitCode: 0 };
  }
  // A well-formed failure result: EXACTLY the keys {operation, outcome, schemaVersion}, and the `operation` value
  // is the requested operation or the reviewed `UNPARSED` sentinel (F05 — not merely a key count).
  const failKeys = Object.keys(record).sort();
  if (
    failKeys.length !== 3 ||
    failKeys[0] !== 'operation' ||
    failKeys[1] !== 'outcome' ||
    failKeys[2] !== 'schemaVersion' ||
    (record.operation !== operation && record.operation !== 'UNPARSED')
  ) {
    return { ok: false, operation, outcome: 'INTERNAL_ERROR', exitCode: output.code };
  }
  return { ok: false, operation, outcome, exitCode: output.code };
}

/** Run one bridge operation with an internally derived request; never a caller-selectable executable or argv. */
async function runBridge(operation: As1BridgeOperation, signalKeys?: SignalRequestKeys, options?: As1BridgeRunOptions): Promise<As1BridgeResult> {
  assertBridgeLiteralIdentity();
  // F05: a MONOTONIC whole-operation clock. It is checked immediately before spawn and on EVERY completion path.
  const now = options?.nowMs ?? ((): number => performance.now());
  const startedMono = now();
  const requestValue: Record<string, unknown> =
    operation === 'CAPABILITY_PROBE'
      ? { operation, schemaVersion: BRIDGE_REQUEST_SCHEMA }
      : { ...signalKeys, operation, schemaVersion: BRIDGE_REQUEST_SCHEMA };
  const requestBytes = Buffer.concat([canonicalBytes(requestValue), Buffer.from('\n', 'utf8')]);
  if (requestBytes.byteLength - 1 > REQUEST_MAX_BYTES || requestBytes.byteLength > STDIN_MAX_BYTES) {
    return { ok: false, operation, outcome: 'REQUEST_REJECTED', exitCode: null };
  }

  // Deterministic-test injection seam: decode a crafted child output through the SAME strict decoder + deadline.
  if (options?.childRunner !== undefined) {
    const output = await options.childRunner(requestBytes);
    if (now() - startedMono > TOTAL_OPERATION_DEADLINE_MS) return { ok: false, operation, outcome: 'BRIDGE_TIMEOUT', exitCode: output.code };
    return parseBridgeResult(operation, output);
  }

  let interpreter: VerifiedInterpreter;
  try {
    interpreter = await verifyAndOpenInterpreter(startedMono + PRE_SPAWN_DEADLINE_MS);
  } catch (error) {
    return { ok: false, operation, outcome: error instanceof BridgeFailure ? error.outcome : 'CAPABILITY_UNAVAILABLE', exitCode: null };
  }
  try {
    // Checked immediately BEFORE spawn: a pre-spawn overrun never creates the child (F05).
    if (now() - startedMono > PRE_SPAWN_DEADLINE_MS) return { ok: false, operation, outcome: 'BRIDGE_TIMEOUT', exitCode: null };
    const output = await runVerifiedChild(interpreter.fd, requestBytes);
    // On EVERY completion path a total-operation overrun is failure — even a code-0 late success (F05).
    if (now() - startedMono > TOTAL_OPERATION_DEADLINE_MS) return { ok: false, operation, outcome: 'BRIDGE_TIMEOUT', exitCode: output.code };
    return parseBridgeResult(operation, output);
  } finally {
    await interpreter.handle.close().catch(() => undefined);
  }
}

/**
 * Mutation-free capability probe (design §11.1.3). Verifies the executing FD/version and pidfd APIs using only a
 * self pidfd and a zero-event poll; it never signals. Runs before ANY state-root mutation. Every non-success maps
 * to a single redacted result; the caller translates that to `LIFECYCLE_CAPABILITY_UNAVAILABLE`.
 */
export function probeCapability(options?: As1BridgeRunOptions): Promise<As1BridgeResult> {
  return runBridge('CAPABILITY_PROBE', undefined, options);
}

interface SignalRequestKeys {
  readonly expectedLockDevice: string;
  readonly expectedLockInode: string;
  readonly expectedLockSha256: string;
  readonly expectedOwnerPid: number;
  readonly expectedOwnerStartTicks: string;
}

const PROC_STAT_MAX_BYTES = 4_096;

/** Read `/proc/<pid>/stat` field 20 (start ticks) as an exact incarnation-identity value (design §11.1.1). */
async function readOwnerStartTicks(pid: number): Promise<string> {
  const raw = await readFile(`/proc/${String(pid)}/stat`).catch(() => {
    throw new BridgeFailure('OWNER_EXITED');
  });
  if (raw.byteLength > PROC_STAT_MAX_BYTES) throw new BridgeFailure('OWNER_MISMATCH');
  const text = raw.toString('latin1').trim();
  const right = text.lastIndexOf(')');
  if (!text.startsWith(`${String(pid)} (`) || right < 0 || text[right + 1] !== ' ') {
    throw new BridgeFailure('OWNER_MISMATCH');
  }
  const fields = text.slice(right + 2).split(' ');
  const startTicks = fields[19];
  if (startTicks === undefined || !/^(?:0|[1-9][0-9]{0,19})$/u.test(startTicks)) {
    throw new BridgeFailure('OWNER_MISMATCH');
  }
  return startTicks;
}

const OWNER_LOCK_MAX_BYTES = 4_096;

/**
 * The TypeScript signal boundary (design §11.1.3). It no-follow opens and strictly parses the construction-bound
 * owner-UID private one-link lock, requires its exact bytes/device/inode and the caller UID, reads the owner's
 * `/proc/<pid>/stat` start ticks, and derives the seven signal-request keys internally — no field is caller
 * controlled. It then runs the sealed literal, which reopens the same fixed lock, opens one pidfd, observes the
 * owner twice through that pidfd, and sends only the fixed signal through that same incarnation.
 */
export type As1SignalDerivation =
  | { readonly ok: true; readonly keys: SignalRequestKeys }
  | { readonly ok: false; readonly outcome: string };

/**
 * Non-signaling derivation (design §11.1.3, F05): no-follow open and strictly parse the owner-UID private one-link
 * lock, require its exact bytes/device/inode and the caller UID, read `/proc/<pid>/stat` start ticks, and derive
 * the seven signal-request keys — or a redacted failure outcome. It NEVER opens a pidfd or sends a signal, so it
 * is exported for deterministic derivation tests with a controllable lock path.
 */
export async function deriveSignalRequest(lockPath: string): Promise<As1SignalDerivation> {
  try {
    const handle = await open(lockPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    let device: bigint;
    let inode: bigint;
    let digest: string;
    let pid: number;
    try {
      const st = await handle.stat({ bigint: true });
      const currentUid = process.getuid?.();
      if (
        !st.isFile() ||
        st.nlink !== 1n ||
        (Number(st.mode) & 0o7777) !== 0o600 ||
        (currentUid !== undefined && Number(st.uid) !== currentUid)
      ) {
        throw new BridgeFailure('OWNER_MISMATCH');
      }
      const bytes = await handle.readFile();
      if (bytes.byteLength > OWNER_LOCK_MAX_BYTES) throw new BridgeFailure('OWNER_MISMATCH');
      digest = sha256Bytes(bytes);
      device = st.dev;
      inode = st.ino;
      const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new BridgeFailure('OWNER_MISMATCH');
      const record = parsed as Record<string, unknown>;
      if (record.schemaVersion !== 'agent-office.writer-lock.v1' || typeof record.pid !== 'number' || !Number.isInteger(record.pid)) {
        throw new BridgeFailure('OWNER_MISMATCH');
      }
      pid = record.pid;
      if (pid < 1 || pid > 4_194_304) throw new BridgeFailure('OWNER_MISMATCH');
    } finally {
      await handle.close().catch(() => undefined);
    }
    const startTicks = await readOwnerStartTicks(pid);
    return {
      ok: true,
      keys: {
        expectedLockDevice: device.toString(10),
        expectedLockInode: inode.toString(10),
        expectedLockSha256: digest,
        expectedOwnerPid: pid,
        expectedOwnerStartTicks: startTicks,
      },
    };
  } catch (error) {
    if (error instanceof BridgeFailure) return { ok: false, outcome: error.outcome };
    if (isNodeError(error, 'ENOENT')) return { ok: false, outcome: 'OWNER_EXITED' };
    return { ok: false, outcome: 'OWNER_MISMATCH' };
  }
}

/** Internal: derive from a lock path, then run the sealed bridge. Not exported — the production surface is fixed. */
async function signalOwnerAtLock(
  lockPath: string,
  operation: 'CLEAN_STOP' | 'INCIDENT_KILL',
  options?: As1BridgeRunOptions,
): Promise<As1BridgeResult> {
  const derived = await deriveSignalRequest(lockPath);
  if (!derived.ok) return { ok: false, operation, outcome: derived.outcome, exitCode: null };
  return runBridge(operation, derived.keys, options);
}

/**
 * The PRODUCTION observer signal boundary (design §11.1.3, F05). It targets ONLY the construction-bound fixed owner
 * lock — no caller-selected lock path exists at this surface. `options` is a test-only decode/deadline seam.
 */
export function signalFixedOwner(operation: 'CLEAN_STOP' | 'INCIDENT_KILL', options?: As1BridgeRunOptions): Promise<As1BridgeResult> {
  return signalOwnerAtLock(AS1_FIXED_OWNER_LOCK_PATH, operation, options);
}

export interface WriterLockMetadata {
  readonly schemaVersion: 'agent-office.writer-lock.v1';
  readonly pid: number;
  readonly bootId: string;
  readonly buildId: string;
  readonly stateRootId: string;
  readonly acquiredAt: string;
  readonly ownershipToken: string;
}

export interface AcquireWriterLockOptions {
  readonly buildId: string;
  readonly stateRootId: string;
  readonly acquiredAt: string;
  readonly pid?: number;
  readonly bootId?: string;
  /**
   * When true (the foreground owner), retain the exact O_EXCL creating descriptor for the process lifetime and
   * require it to be close-on-exec (design §11.1). When false/absent (a one-shot command), the handle is closed
   * after the durable write exactly as in Phase A. Both release paths verify and unlink the same v1 record.
   */
  readonly retainForForeground?: boolean;
}

/**
 * Phase-aware release outcome (F01-B): distinguishes the AUTHORITATIVE namespace outcome from cleanup durability.
 * - `RELEASED`: the namespace lock was UNLINKED — authority is irrevocably relinquished. `cleanupAmbiguity` is a bounded
 *   code when a POST-unlink step (directory fsync / retained-handle close) failed; the authority is still gone.
 * - `RETAINED`: a PRE-unlink failure while the fixed leaf is still positively this exact owner's lock — authority is
 *   retained (the caller remains the sole writer and may fallback-kill). The namespace lock still exists.
 * - `LOST`: ownership could NOT be positively proven (identity mismatch / leaf gone). Authority ceases; NO unlink was
 *   performed and NO authority-bearing fallback write is permitted.
 */
export type WriterLockReleaseOutcome =
  | { readonly authority: 'RELEASED'; readonly cleanupAmbiguity: string | null }
  | { readonly authority: 'RETAINED'; readonly reason: string }
  | { readonly authority: 'LOST'; readonly reason: string };

/**
 * Test-only deterministic-interleaving seam (F01-B). `afterNamespaceUnlink` fires immediately AFTER the namespace lock
 * is unlinked and BEFORE post-unlink durability (directory fsync / retained-handle close), so a test can acquire a
 * SECOND writer at the exact freed-namespace interleaving and/or simulate a post-unlink durability failure (by throwing)
 * to prove that the old owner irrevocably ceases authority. Production callers never supply it.
 */
export interface WriterLockReleaseHooks {
  readonly afterNamespaceUnlink?: () => void | Promise<void>;
}

/** A bounded, redacted code for a release failure — never a raw error/message. */
function releaseErrorCode(error: unknown): string {
  if (error instanceof StoreError) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error && typeof (error as { readonly code: unknown }).code === 'string') {
    return (error as { readonly code: string }).code;
  }
  return 'IO_ERROR';
}

export class WriterLock {
  private released = false;
  private handle: import('node:fs/promises').FileHandle | null;

  private constructor(
    private readonly lockPath: string,
    private readonly metadata: WriterLockMetadata,
    handle: import('node:fs/promises').FileHandle | null,
  ) {
    this.handle = handle;
  }

  public static async acquire(root: string, options: AcquireWriterLockOptions): Promise<WriterLock> {
    const canonicalRoot = await validateStateRoot(root);
    const format = await readStateRootFormat(canonicalRoot);
    if (format.stateRootId !== options.stateRootId) {
      throw new StoreError('STATE_ROOT_INVALID', 'writer state-root identity does not match the format marker');
    }
    const lockDirectory = await ensurePrivateDirectory(canonicalRoot, 'locks');
    const lockPath = path.join(lockDirectory, 'writer.lock');
    const metadata: WriterLockMetadata = {
      schemaVersion: 'agent-office.writer-lock.v1',
      pid: options.pid ?? process.pid,
      bootId: options.bootId ?? (await readBootId()),
      buildId: options.buildId,
      stateRootId: options.stateRootId,
      acquiredAt: options.acquiredAt,
      ownershipToken: randomBytes(32).toString('hex'),
    };
    let handle: import('node:fs/promises').FileHandle | undefined;
    let created = false;
    try {
      handle = await open(
        lockPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        FILE_MODE,
      );
      created = true;
      const bytes = Buffer.concat([canonicalBytes(metadata), Buffer.from('\n', 'utf8')]);
      const result = await handle.write(bytes, 0, bytes.byteLength, 0);
      if (result.bytesWritten !== bytes.byteLength) {
        throw new StoreError('IO_DURABILITY_FAILED', 'short writer-lock write');
      }
      await handle.sync();
      await fsyncDirectory(lockDirectory);
      if (options.retainForForeground === true) {
        // Retain the ORIGINAL creating descriptor as the causal acquisition proof; require it close-on-exec.
        await assertCloseOnExec(handle.fd);
        return new WriterLock(lockPath, metadata, handle);
      }
      await handle.close();
      handle = undefined;
      return new WriterLock(lockPath, metadata, null);
    } catch (error) {
      await handle?.close().catch(() => undefined);
      if (isNodeError(error, 'EEXIST')) {
        throw new StoreError('SECOND_WRITER_DETECTED', 'a writer lock already owns this state root');
      }
      if (created) await unlink(lockPath).catch(() => undefined);
      throw error;
    }
  }

  /** The retained foreground descriptor (design §11.1) — bound into the composition and never child-inherited. */
  public retainedFd(): number | null {
    return this.handle?.fd ?? null;
  }

  /**
   * Throwing release for callers that only need a clean success/failure (e.g. the event store and acquire rollback).
   * Delegates to the phase-aware `releaseAuthority()` and throws on ANY non-clean outcome, preserving the historical
   * fail-closed contract. AS1 lifecycle callers use `releaseAuthority()` directly to distinguish namespace authority
   * from cleanup durability.
   */
  public async release(): Promise<void> {
    const outcome = await this.releaseAuthority();
    if (outcome.authority === 'RELEASED' && outcome.cleanupAmbiguity === null) return;
    const detail = outcome.authority === 'RELEASED' ? `RELEASED:${outcome.cleanupAmbiguity}` : `${outcome.authority}:${outcome.reason}`;
    throw new StoreError('STATE_ROOT_INVALID', `writer lock release did not prove a clean namespace release (${detail})`);
  }

  /**
   * Phase-aware, one-writer-safe release (design §11.1, F01-B). The namespace UNLINK is the single authority-relinquishing
   * act: once it succeeds this owner IRREVOCABLY loses authority even if a later directory fsync or retained-handle close
   * reports ambiguity (surfaced as `cleanupAmbiguity`, never a clean claim). A failure BEFORE unlink retains authority
   * ONLY while the exact fixed leaf is still positively proven to be this owner's lock; otherwise ownership is not proven
   * and the outcome is `LOST` with NO unlink and NO authority-bearing mutation. Retained handles are closed
   * DETERMINISTICALLY on every released/lost path (never left for GC). No ambiguous release is retried.
   */
  public async releaseAuthority(hooks?: WriterLockReleaseHooks): Promise<WriterLockReleaseOutcome> {
    if (this.released) return { authority: 'RELEASED', cleanupAmbiguity: null };
    if (this.handle !== null) {
      // Prove ownership BEFORE unlink. A mismatch means the fixed leaf is not (or no longer) this owner's lock → LOST:
      // never unlink an object we do not own, close the retained handle, and cease authority with no fallback write.
      let identityError: string | null = null;
      try {
        await this.assertForegroundIdentity();
      } catch (error) {
        identityError = releaseErrorCode(error);
      }
      if (identityError !== null) {
        await this.closeRetainedHandle().catch(() => undefined);
        this.released = true;
        return { authority: 'LOST', reason: identityError };
      }
      // Ownership proven. The unlink is authority-relinquishing; a failure HERE is pre-unlink → still positively ours →
      // RETAINED (keep the retained handle + lock; do not retry).
      try {
        await unlink(this.lockPath);
      } catch (error) {
        return { authority: 'RETAINED', reason: releaseErrorCode(error) };
      }
      // Post-unlink: authority is IRREVOCABLY RELEASED regardless of the durability outcome. Close the retained handle
      // deterministically; a post-unlink fsync/close failure (or the injected seam) is a cleanup ambiguity ONLY (never
      // retained authority, never a fallback write). `this.released` is set FIRST so no concurrent authority claim can
      // survive even if a durability step throws.
      this.released = true;
      let cleanupAmbiguity: string | null = null;
      if (hooks?.afterNamespaceUnlink !== undefined) {
        try {
          await hooks.afterNamespaceUnlink();
        } catch (error) {
          cleanupAmbiguity = `POST_UNLINK:${releaseErrorCode(error)}`;
        }
      }
      try {
        await fsyncDirectory(path.dirname(this.lockPath));
      } catch (error) {
        cleanupAmbiguity ??= `FSYNC:${releaseErrorCode(error)}`;
      }
      try {
        await this.closeRetainedHandle();
      } catch (error) {
        cleanupAmbiguity ??= `CLOSE:${releaseErrorCode(error)}`;
      }
      return { authority: 'RELEASED', cleanupAmbiguity };
    }
    // One-shot (non-foreground) release: no retained descriptor. Prove exact-byte ownership, then unlink.
    let current: Buffer;
    try {
      current = await readFile(this.lockPath);
    } catch (error) {
      // The leaf is gone before ownership could be proven → LOST (no unlink, no fallback).
      this.released = true;
      return { authority: 'LOST', reason: releaseErrorCode(error) };
    }
    if (!current.equals(Buffer.concat([canonicalBytes(this.metadata), Buffer.from('\n', 'utf8')]))) {
      this.released = true;
      return { authority: 'LOST', reason: 'STATE_ROOT_INVALID' };
    }
    try {
      await unlink(this.lockPath);
    } catch (error) {
      return { authority: 'RETAINED', reason: releaseErrorCode(error) };
    }
    let cleanupAmbiguity: string | null = null;
    try {
      await fsyncDirectory(path.dirname(this.lockPath));
    } catch (error) {
      cleanupAmbiguity = `FSYNC:${releaseErrorCode(error)}`;
    }
    this.released = true;
    return { authority: 'RELEASED', cleanupAmbiguity };
  }

  /** The retained descriptor and a no-follow reopen of the CURRENT path must agree on device, inode, regular type,
   *  owner, one link, private mode, and the exact canonical-plus-one-LF v1 bytes (design §11.1, F05). Throws on any
   *  mismatch; closes the reopened handle deterministically and never touches the retained handle. */
  private async assertForegroundIdentity(): Promise<void> {
    if (this.handle === null) return;
    const retainedStat = await this.handle.stat({ bigint: true });
    const reopened = await open(this.lockPath, constants.O_RDONLY | constants.O_NOFOLLOW).catch((error: unknown) => {
      throw new StoreError('STATE_ROOT_INVALID', 'writer lock disappeared before release', { cause: error });
    });
    try {
      const current = await reopened.stat({ bigint: true });
      const currentUid = process.getuid?.();
      if (
        !current.isFile() ||
        current.dev !== retainedStat.dev ||
        current.ino !== retainedStat.ino ||
        current.nlink !== 1n ||
        (Number(current.mode) & 0o7777) !== FILE_MODE ||
        (currentUid !== undefined && Number(current.uid) !== currentUid)
      ) {
        throw new StoreError('STATE_ROOT_INVALID', 'writer lock identity changed unexpectedly before release');
      }
      const bytes = await reopened.readFile();
      if (!bytes.equals(Buffer.concat([canonicalBytes(this.metadata), Buffer.from('\n', 'utf8')]))) {
        throw new StoreError('STATE_ROOT_INVALID', 'writer lock bytes are not the exact canonical-plus-one-LF record owned by this process');
      }
    } finally {
      await reopened.close().catch(() => undefined);
    }
  }

  /** Close the retained O_EXCL descriptor deterministically and drop it (never left for garbage collection). May throw
   *  the close error so a post-unlink caller can surface a cleanup ambiguity; the handle is dropped either way. */
  private async closeRetainedHandle(): Promise<void> {
    const handle = this.handle;
    this.handle = null;
    if (handle !== null) await handle.close();
  }

  /** True once this lock has released or lost namespace authority — no authority-bearing mutation may follow. */
  public isReleased(): boolean {
    return this.released;
  }

  public getMetadata(): WriterLockMetadata {
    return this.metadata;
  }

  public static async recoverStale(
    root: string,
    options: {
      readonly operatorAuthorized: boolean;
      readonly recoveredAt: string;
      readonly isProcessAlive?: (pid: number) => boolean;
    },
  ): Promise<string> {
    if (!options.operatorAuthorized) {
      throw new StoreError('SECOND_WRITER_DETECTED', 'explicit operator authority is required to recover a stale lock');
    }
    const canonicalRoot = await validateStateRoot(root);
    const lockPath = path.join(canonicalRoot, 'locks', 'writer.lock');
    const bytes = await readFile(lockPath);
    const metadata = JSON.parse(bytes.toString('utf8')) as WriterLockMetadata;
    const isAlive = options.isProcessAlive ?? defaultProcessAlive;
    if (metadata.bootId === (await readBootId()) && isAlive(metadata.pid)) {
      throw new StoreError('SECOND_WRITER_DETECTED', 'writer process is still alive');
    }
    const quarantineDirectory = await ensurePrivateDirectory(canonicalRoot, 'quarantine');
    const contentHash = sha256Bytes(bytes);
    const hashSuffix = contentHash.slice('sha256:'.length);
    const preservedPath = path.join(quarantineDirectory, `writer-lock-${hashSuffix}.json`);
    try {
      await link(lockPath, preservedPath);
    } catch (error) {
      if (!isNodeError(error, 'EEXIST') || sha256Bytes(await readFile(preservedPath)) !== contentHash) {
        throw error;
      }
    }
    await unlink(lockPath);
    await fsyncDirectory(path.dirname(lockPath));
    await fsyncDirectory(quarantineDirectory);
    await writeAtomicCanonicalJson(`${preservedPath}.recovery.json`, {
      schemaVersion: 'agent-office.writer-lock-recovery.v1',
      contentHash,
      recoveredAt: options.recoveredAt,
      originalMetadata: metadata,
    });
    return preservedPath;
  }
}

const FDINFO_MAX_BYTES = 4_096;

/** Require the retained lock descriptor to be close-on-exec via its `/proc/self/fdinfo/<fd>` projection. */
async function assertCloseOnExec(fd: number): Promise<void> {
  const raw = await readFile(`/proc/self/fdinfo/${String(fd)}`, 'utf8').catch(() => {
    throw new StoreError('IO_DURABILITY_FAILED', 'retained writer-lock descriptor has no fdinfo projection');
  });
  if (raw.length > FDINFO_MAX_BYTES) throw new StoreError('IO_DURABILITY_FAILED', 'writer-lock fdinfo projection is oversized');
  const flagLines = raw.split('\n').filter((line) => line.startsWith('flags:'));
  if (flagLines.length !== 1) throw new StoreError('IO_DURABILITY_FAILED', 'writer-lock fdinfo has no single flags line');
  const flags = Number.parseInt((flagLines[0] ?? '').slice('flags:'.length).trim(), 8);
  if (!Number.isInteger(flags) || (flags & LINUX_O_CLOEXEC) !== LINUX_O_CLOEXEC) {
    throw new StoreError('IO_DURABILITY_FAILED', 'retained writer-lock descriptor is not close-on-exec');
  }
}

async function readBootId(): Promise<string> {
  try {
    return (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
  } catch {
    return 'BOOT_ID_UNAVAILABLE';
  }
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isNodeError(error, 'ESRCH');
  }
}
