#!/usr/bin/python3
"""Bounded, no-follow persistence helper for OmaType.

The QML caller passes only an operation, an allowlisted absolute path, and a
bounded byte limit. File contents are transferred over stdio, never argv.
"""

from __future__ import annotations

import errno
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

SETTINGS_CAP = 262_144
LARGE_CAP = 16_777_216
TARGETS = {
    (".config", "omarchy", "omatype-settings.json"): SETTINGS_CAP,
    (".local", "state", "omarchy", "omatype-settings.json"): SETTINGS_CAP,
    (".local", "state", "omarchy", "omatype-history.json"): LARGE_CAP,
    (".local", "state", "omarchy", "omatype-history.csv"): LARGE_CAP,
}
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
READ_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
WRITE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC


class BoundaryError(Exception):
    def __init__(self, message: str, code: int = EXIT_UNSAFE):
        super().__init__(message)
        self.code = code


def fail(message: str, code: int) -> int:
    print(message, file=sys.stderr)
    return code


def checked_request(argv: list[str]) -> tuple[str, str, tuple[str, ...], int]:
    if len(argv) != 4 or argv[1] not in {"read", "write"}:
        raise BoundaryError("usage: secure_file.py read|write PATH CAP", EXIT_USAGE)
    operation, path = argv[1], argv[2]
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
    return operation, home, parts, cap


def verify_directory(fd: int) -> None:
    info = os.fstat(fd)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid():
        raise BoundaryError("path component is not an owned directory")


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


def read_target(home: str, parts: tuple[str, ...], cap: int) -> int:
    parent, name = open_parent(home, parts, False)
    fd = -1
    try:
        try:
            fd = os.open(name, READ_FLAGS, dir_fd=parent)
        except FileNotFoundError as error:
            raise BoundaryError("target does not exist", EXIT_ABSENT) from error
        except OSError as error:
            raise BoundaryError(f"cannot open target safely: {error.strerror}") from error
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid():
            raise BoundaryError("target is not an owned regular file")
        if info.st_size > cap:
            raise BoundaryError("file exceeds byte cap")
        data = read_all(fd, cap)
        try:
            text = data.decode("utf-8", "strict")
        except UnicodeDecodeError as error:
            raise BoundaryError("file is not valid UTF-8", EXIT_ENCODING) from error
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
    # The QML pipe remains open. A short grace period catches bytes appended to
    # the single frame without requiring EOF from the long-lived Process API.
    ready, _, _ = select.select([input_fd], [], [], 0.05)
    if ready:
        extra = os.read(input_fd, 1)
        if extra:
            raise BoundaryError("extra bytes after write frame", EXIT_FRAME)
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


def write_target(home: str, parts: tuple[str, ...], cap: int) -> int:
    data = read_frame(cap)
    parent, name = open_parent(home, parts, True)
    temp_name = ""
    fd = -1
    try:
        try:
            existing = os.stat(name, dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            existing = None
        if existing is not None:
            if stat.S_ISLNK(existing.st_mode):
                pass  # rename below replaces the link itself; it is never followed.
            elif not stat.S_ISREG(existing.st_mode) or existing.st_uid != os.geteuid():
                raise BoundaryError("destination is not an owned regular file")
        for _ in range(32):
            candidate = f".{name}.tmp-{secrets.token_hex(12)}"
            try:
                fd = os.open(candidate, WRITE_FLAGS, 0o600, dir_fd=parent)
                temp_name = candidate
                break
            except FileExistsError:
                continue
        if fd < 0:
            raise BoundaryError("cannot allocate exclusive temporary file", EXIT_IO)
        os.fchmod(fd, 0o600)
        write_all(fd, data)
        os.fsync(fd)
        os.close(fd)
        fd = -1
        os.rename(temp_name, name, src_dir_fd=parent, dst_dir_fd=parent)
        temp_name = ""
        os.fsync(parent)
        return EXIT_OK
    except OSError as error:
        raise BoundaryError(f"secure write failed: {error.strerror}", EXIT_IO) from error
    finally:
        if fd >= 0:
            os.close(fd)
        if temp_name:
            try:
                os.unlink(temp_name, dir_fd=parent)
            except FileNotFoundError:
                pass
        os.close(parent)


def main(argv: list[str]) -> int:
    try:
        operation, home, parts, cap = checked_request(argv)
        if operation == "read":
            return read_target(home, parts, cap)
        return write_target(home, parts, cap)
    except BoundaryError as error:
        return fail(str(error), error.code)
    except OSError as error:
        return fail(f"I/O failure: {error.strerror}", EXIT_IO)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
