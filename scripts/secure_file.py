#!/usr/bin/python3
"""Bounded, revision-safe persistence helper for OmaType.

The QML caller passes only an operation, an allowlisted absolute path, a bounded
byte limit, and (for writes) an expected revision. Contents travel over stdio.
"""

from __future__ import annotations

import errno
import fcntl
import hashlib
import os
import secrets
import select
import stat
import sys
import time

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_ABSENT = 3
EXIT_UNSAFE = 4
EXIT_IO = 5
EXIT_ENCODING = 6
EXIT_FRAME = 7
EXIT_CONFLICT = 8

SETTINGS_CAP = 262_144
LARGE_CAP = 16_777_216
TARGETS = {
    (".config", "omarchy", "omatype-settings.json"): SETTINGS_CAP,
    (".config", "omarchy", "omatype-keyboard.json"): SETTINGS_CAP,
    (".local", "state", "omarchy", "omatype-settings.json"): SETTINGS_CAP,
    (".local", "state", "omarchy", "omatype-history.json"): LARGE_CAP,
    (".local", "state", "omarchy", "omatype-history.csv"): LARGE_CAP,
}
READ_ONLY_TARGETS = {
    (".config", "omarchy", "omatype-keyboard.json"),
}
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
READ_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
WRITE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC
REVISION_RE = __import__("re").compile(r"^[0-9a-f]{64}$")


class BoundaryError(Exception):
    def __init__(self, message: str, code: int = EXIT_UNSAFE):
        super().__init__(message)
        self.code = code


def fail(message: str, code: int) -> int:
    print(message, file=sys.stderr)
    return code


def control_revision(revision: str) -> None:
    print(f"revision:{revision}", file=sys.stderr)


def checked_request(argv: list[str]) -> tuple[str, str, tuple[str, ...], int, str]:
    if len(argv) not in {4, 5} or argv[1] not in {"read", "write"}:
        raise BoundaryError("usage: secure_file.py read PATH CAP | write PATH CAP EXPECTED", EXIT_USAGE)
    operation, path = argv[1], argv[2]
    if (operation == "read") != (len(argv) == 4):
        raise BoundaryError("invalid operation arguments", EXIT_USAGE)
    expected = argv[4] if operation == "write" else ""
    if operation == "write" and expected not in {"absent", "any"} and not REVISION_RE.fullmatch(expected):
        raise BoundaryError("invalid expected revision", EXIT_USAGE)
    try:
        cap = int(argv[3], 10)
    except ValueError as error:
        raise BoundaryError("invalid byte cap", EXIT_USAGE) from error
    home = os.environ.get("HOME", "")
    if not home or not os.path.isabs(home) or not os.path.isabs(path):
        raise BoundaryError("HOME and target path must be absolute")
    home = os.path.normpath(home)
    path = os.path.normpath(path)
    try:
        relative = os.path.relpath(path, home)
    except ValueError as error:
        raise BoundaryError("target is outside HOME") from error
    parts = tuple(relative.split(os.sep))
    allowed_cap = TARGETS.get(parts)
    if allowed_cap is None or cap <= 0 or cap > allowed_cap:
        raise BoundaryError("target path or byte cap is not allowed")
    if operation == "write" and parts in READ_ONLY_TARGETS:
        raise BoundaryError("target is read-only")
    return operation, home, parts, cap, expected


def verify_directory(fd: int) -> None:
    info = os.fstat(fd)
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid()
            or info.st_mode & (stat.S_IWGRP | stat.S_IWOTH)):
        raise BoundaryError("path component is not a private owned directory")


def open_parent(home: str, parts: tuple[str, ...], create: bool) -> tuple[int, str]:
    try:
        current = os.open(home, DIR_FLAGS)
    except OSError as error:
        raise BoundaryError(f"cannot open HOME safely: {error.strerror}") from error
    try:
        verify_directory(current)
        for component in parts[:-1]:
            try:
                child = os.open(component, DIR_FLAGS, dir_fd=current)
            except FileNotFoundError:
                if not create:
                    raise BoundaryError("target does not exist", EXIT_ABSENT)
                try:
                    os.mkdir(component, 0o700, dir_fd=current)
                    child = os.open(component, DIR_FLAGS, dir_fd=current)
                except OSError as error:
                    raise BoundaryError(f"cannot create directory safely: {error.strerror}") from error
            except OSError as error:
                if error.errno == errno.ENOENT:
                    raise BoundaryError("target does not exist", EXIT_ABSENT) from error
                raise BoundaryError(f"unsafe path component: {error.strerror}") from error
            os.close(current)
            current = child
            verify_directory(current)
        return current, parts[-1]
    except Exception:
        os.close(current)
        raise


def read_all(fd: int, cap: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while total <= cap:
        try:
            chunk = os.read(fd, min(65_536, cap + 1 - total))
        except BlockingIOError:
            ready, _, _ = select.select([fd], [], [], 1.0)
            if not ready:
                raise BoundaryError("regular file read timed out", EXIT_IO)
            continue
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
    data = b"".join(chunks)
    if len(data) > cap:
        raise BoundaryError("file exceeds byte cap")
    return data


def descriptor_bytes(fd: int, cap: int) -> bytes:
    os.lseek(fd, 0, os.SEEK_SET)
    return read_all(fd, cap)


def revision(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def owned_regular(info: os.stat_result) -> bool:
    return stat.S_ISREG(info.st_mode) and info.st_uid == os.geteuid()


def read_target(home: str, parts: tuple[str, ...], cap: int) -> int:
    try:
        parent, name = open_parent(home, parts, False)
    except BoundaryError as error:
        if error.code == EXIT_ABSENT:
            control_revision("absent")
        raise
    fd = -1
    try:
        try:
            fd = os.open(name, READ_FLAGS, dir_fd=parent)
        except FileNotFoundError as error:
            control_revision("absent")
            raise BoundaryError("target does not exist", EXIT_ABSENT) from error
        except OSError as error:
            raise BoundaryError(f"cannot open target safely: {error.strerror}") from error
        info = os.fstat(fd)
        if not owned_regular(info):
            raise BoundaryError("target is not an owned regular file")
        if info.st_size > cap:
            raise BoundaryError("file exceeds byte cap")
        data = read_all(fd, cap)
        try:
            text = data.decode("utf-8", "strict")
        except UnicodeDecodeError as error:
            raise BoundaryError("file is not valid UTF-8", EXIT_ENCODING) from error
        control_revision(revision(data))
        sys.stdout.write(text)
        return EXIT_OK
    finally:
        if fd >= 0:
            os.close(fd)
        os.close(parent)


def read_frame(cap: int) -> bytes:
    input_fd = sys.stdin.fileno()
    deadline = time.monotonic() + 5.0
    header = bytearray()
    while len(header) <= 32:
        timeout = deadline - time.monotonic()
        if timeout <= 0:
            raise BoundaryError("malformed write frame", EXIT_FRAME)
        ready, _, _ = select.select([input_fd], [], [], timeout)
        if not ready:
            raise BoundaryError("malformed write frame", EXIT_FRAME)
        byte = os.read(input_fd, 1)
        if not byte:
            raise BoundaryError("malformed write frame", EXIT_FRAME)
        if byte == b"\n":
            break
        header.extend(byte)
    else:
        raise BoundaryError("malformed write frame", EXIT_FRAME)
    number = bytes(header)
    if not number or not number.isascii() or not number.isdigit():
        raise BoundaryError("malformed write frame", EXIT_FRAME)
    length = int(number, 10)
    if length > cap:
        raise BoundaryError("write frame exceeds byte cap", EXIT_FRAME)
    chunks: list[bytes] = []
    remaining = length
    while remaining:
        timeout = deadline - time.monotonic()
        if timeout <= 0:
            raise BoundaryError("truncated write frame", EXIT_FRAME)
        ready, _, _ = select.select([input_fd], [], [], timeout)
        if not ready:
            raise BoundaryError("truncated write frame", EXIT_FRAME)
        chunk = os.read(input_fd, min(65_536, remaining))
        if not chunk:
            raise BoundaryError("truncated write frame", EXIT_FRAME)
        chunks.append(chunk)
        remaining -= len(chunk)
    data = b"".join(chunks)
    try:
        data.decode("utf-8", "strict")
    except UnicodeDecodeError as error:
        raise BoundaryError("write frame is not valid UTF-8", EXIT_ENCODING) from error
    return data


def write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    written = 0
    while written < len(view):
        count = os.write(fd, view[written:])
        if count <= 0:
            raise OSError(errno.EIO, "short write")
        written += count


def current_target(parent: int, name: str, cap: int) -> tuple[str, int, os.stat_result | None]:
    try:
        fd = os.open(name, READ_FLAGS, dir_fd=parent)
    except FileNotFoundError:
        return "absent", -1, None
    except OSError as error:
        raise BoundaryError(f"destination cannot be opened safely: {error.strerror}", EXIT_CONFLICT) from error
    try:
        info = os.fstat(fd)
        if not owned_regular(info) or info.st_size > cap:
            raise BoundaryError("destination is not an allowed owned regular file", EXIT_CONFLICT)
        try:
            data = read_all(fd, cap)
        except BoundaryError as error:
            raise BoundaryError("destination changed while reading", EXIT_CONFLICT) from error
        return revision(data), fd, info
    except Exception:
        os.close(fd)
        raise


def same_path_identity(parent: int, name: str, expected: os.stat_result | None) -> bool:
    try:
        actual = os.stat(name, dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError:
        return expected is None
    if expected is None:
        return False
    return (owned_regular(actual) and actual.st_dev == expected.st_dev
            and actual.st_ino == expected.st_ino and actual.st_uid == expected.st_uid)


def same_parent_identity(home: str, parts: tuple[str, ...], parent: int, name: str) -> bool:
    current = -1
    try:
        current, current_name = open_parent(home, parts, False)
        expected = os.fstat(parent)
        actual = os.fstat(current)
        return (current_name == name and actual.st_dev == expected.st_dev
                and actual.st_ino == expected.st_ino and actual.st_uid == expected.st_uid)
    except (BoundaryError, OSError):
        return False
    finally:
        if current >= 0:
            os.close(current)


def before_publish(_parent: int, _name: str) -> None:
    """Test seam invoked before the final descriptor/path correspondence check."""


def write_target(home: str, parts: tuple[str, ...], cap: int, expected: str) -> int:
    data = read_frame(cap)
    parent, name = open_parent(home, parts, True)
    temp_name = ""
    temp_fd = -1
    current_fd = -1
    current_info = None
    try:
        fcntl.flock(parent, fcntl.LOCK_EX)
        if expected == "any":
            try:
                initial = os.stat(name, dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError:
                initial = None
            if initial is not None and not stat.S_ISLNK(initial.st_mode):
                if not owned_regular(initial):
                    raise BoundaryError("destination is not replaceable")
                current_revision, current_fd, current_info = current_target(parent, name, cap)
            else:
                current_revision = "absent" if initial is None else "symlink"
                current_info = initial
        else:
            current_revision, current_fd, current_info = current_target(parent, name, cap)
            if current_revision != expected:
                raise BoundaryError("destination revision conflict", EXIT_CONFLICT)

        for _ in range(32):
            candidate = f".{name}.tmp-{secrets.token_hex(12)}"
            try:
                temp_fd = os.open(candidate, WRITE_FLAGS, 0o600, dir_fd=parent)
                temp_name = candidate
                break
            except FileExistsError:
                continue
        if temp_fd < 0:
            raise BoundaryError("cannot allocate exclusive temporary file", EXIT_IO)
        os.fchmod(temp_fd, 0o600)
        write_all(temp_fd, data)
        os.fsync(temp_fd)
        os.close(temp_fd)
        temp_fd = -1

        before_publish(parent, name)
        if not same_parent_identity(home, parts, parent, name):
            raise BoundaryError("parent directory changed before publish", EXIT_CONFLICT)
        if expected == "any" and current_revision == "symlink":
            try:
                final_info = os.stat(name, dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError:
                raise BoundaryError("destination changed before publish", EXIT_CONFLICT)
            if not stat.S_ISLNK(final_info.st_mode) or final_info.st_dev != current_info.st_dev or final_info.st_ino != current_info.st_ino:
                raise BoundaryError("destination changed before publish", EXIT_CONFLICT)
        elif not same_path_identity(parent, name, current_info):
            raise BoundaryError("destination changed before publish", EXIT_CONFLICT)
        if current_fd >= 0:
            try:
                final_revision = revision(descriptor_bytes(current_fd, cap))
            except BoundaryError as error:
                raise BoundaryError("destination changed before publish", EXIT_CONFLICT) from error
            if final_revision != current_revision:
                raise BoundaryError("destination changed before publish", EXIT_CONFLICT)

        os.rename(temp_name, name, src_dir_fd=parent, dst_dir_fd=parent)
        temp_name = ""
        os.fsync(parent)
        control_revision(revision(data))
        return EXIT_OK
    except OSError as error:
        raise BoundaryError(f"secure write failed: {error.strerror}", EXIT_IO) from error
    finally:
        if current_fd >= 0:
            os.close(current_fd)
        if temp_fd >= 0:
            os.close(temp_fd)
        if temp_name:
            try:
                os.unlink(temp_name, dir_fd=parent)
            except FileNotFoundError:
                pass
        os.close(parent)


def main(argv: list[str]) -> int:
    try:
        operation, home, parts, cap, expected = checked_request(argv)
        if operation == "read":
            return read_target(home, parts, cap)
        return write_target(home, parts, cap, expected)
    except BoundaryError as error:
        return fail(str(error), error.code)
    except OSError as error:
        return fail(f"I/O failure: {error.strerror}", EXIT_IO)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
