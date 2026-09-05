"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");

const root = path.join(__dirname, "..");
const helper = path.join(root, "scripts", "secure_file.py");
const python = "/usr/bin/python3";

function fixture() {
  const home = fs.mkdtempSync(path.join(__dirname, ".secure-file-"));
  return {
    home,
    settings: path.join(home, ".config", "omarchy", "omatype-settings.json"),
    keyboard: path.join(home, ".config", "omarchy", "omatype-keyboard.json"),
    legacy: path.join(home, ".local", "state", "omarchy", "omatype-settings.json"),
    history: path.join(home, ".local", "state", "omarchy", "omatype-history.json"),
    csv: path.join(home, ".local", "state", "omarchy", "omatype-history.csv"),
    cleanup() { fs.rmSync(home, {recursive: true, force: true}); }
  };
}

function run(home, operation, target, cap, input, expected = "any") {
  const args = ["-I", "-S", helper, operation, target, String(cap)];
  if (operation === "write") args.push(expected);
  return spawnSync(python, args, {
    env: {HOME: home, LANG: "C.UTF-8"},
    input,
    encoding: input instanceof Buffer ? null : "utf8",
    timeout: 3000
  });
}

function frame(value) {
  const data = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from(String(data.length) + "\n", "ascii"), data]);
}

function revisionOf(value) {
  return require("node:crypto").createHash("sha256").update(value).digest("hex");
}

function reportedRevision(result) {
  return String(result.stderr).match(/revision:(absent|[0-9a-f]{64})/)?.[1] || "";
}

function tempFiles(target) {
  if (!fs.existsSync(path.dirname(target))) return [];
  return fs.readdirSync(path.dirname(target)).filter(name => name.startsWith("." + path.basename(target) + ".tmp-"));
}

test("secure helper writes and reads Unicode atomically with mode 0600", t => {
  const f = fixture(); t.after(f.cleanup);
  const content = JSON.stringify({label: "café λ"});
  const written = run(f.home, "write", f.settings, 262144, frame(content));
  assert.equal(written.status, 0, String(written.stderr));
  assert.equal(reportedRevision(written), revisionOf(content));
  assert.equal(fs.statSync(f.settings).mode & 0o777, 0o600);
  const read = run(f.home, "read", f.settings, 262144);
  assert.equal(read.status, 0, String(read.stderr));
  assert.equal(reportedRevision(read), revisionOf(content));
  assert.equal(String(read.stdout), content);
  fs.chmodSync(f.settings, 0o644);
  const replaced = run(f.home, "write", f.settings, 262144, frame("{}"));
  assert.equal(replaced.status, 0, String(replaced.stderr));
  assert.equal(fs.statSync(f.settings).mode & 0o777, 0o600);
  assert.deepEqual(tempFiles(f.settings), []);
});

test("missing files are distinct from unsafe files", t => {
  const f = fixture(); t.after(f.cleanup);
  const missing = run(f.home, "read", f.history, 16777216);
  assert.equal(missing.status, 3);
  assert.equal(reportedRevision(missing), "absent");
  fs.mkdirSync(path.dirname(f.history), {recursive: true});
  fs.mkdirSync(f.history);
  const unsafe = run(f.home, "read", f.history, 16777216);
  assert.equal(unsafe.status, 4);
  assert.equal(run(f.home, "write", f.history, 16777216, frame("{}" )).status, 4);
});

test("final symlinks are never read and writes replace only the link", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  const target = path.join(f.home, "target.json");
  fs.writeFileSync(target, "unchanged", {mode: 0o600});
  fs.symlinkSync(target, f.settings);
  const read = run(f.home, "read", f.settings, 262144);
  assert.equal(read.status, 4);
  const content = "{\"safe\":true}";
  const write = run(f.home, "write", f.settings, 262144, frame(content));
  assert.equal(write.status, 0, String(write.stderr));
  assert.equal(fs.lstatSync(f.settings).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(f.settings, "utf8"), content);
  assert.equal(fs.readFileSync(target, "utf8"), "unchanged");
  assert.deepEqual(tempFiles(f.settings), []);
});

test("intermediate symlinks are rejected for reads and writes", t => {
  const f = fixture(); t.after(f.cleanup);
  const elsewhere = path.join(f.home, "elsewhere");
  fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, path.join(f.home, ".config"));
  assert.equal(run(f.home, "read", f.settings, 262144).status, 4);
  assert.equal(run(f.home, "write", f.settings, 262144, frame("{}" )).status, 4);
  assert.equal(fs.readdirSync(elsewhere).length, 0);
});

test("FIFO and Unix socket targets fail without blocking", async t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.history), {recursive: true});
  assert.equal(spawnSync("mkfifo", [f.history]).status, 0);
  const started = Date.now();
  const fifo = run(f.home, "read", f.history, 16777216);
  assert.equal(fifo.status, 4);
  assert.ok(Date.now() - started < 1500, "FIFO read must not hang");
  assert.equal(run(f.home, "write", f.history, 16777216, frame("{}" )).status, 4);
  fs.unlinkSync(f.history);

  const socketScript = "import socket,sys,time;s=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);print('ready',flush=True);time.sleep(5)";
  const child = spawn(python, ["-I", "-S", "-c", socketScript, f.history], {stdio: ["ignore", "pipe", "pipe"]});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket fixture timeout")), 1000);
    child.stdout.once("data", () => { clearTimeout(timer); resolve(); });
    child.once("error", reject);
  });
  t.after(() => child.kill("SIGKILL"));
  assert.equal(run(f.home, "read", f.history, 16777216).status, 4);
  assert.equal(run(f.home, "write", f.history, 16777216, frame("{}" )).status, 4);
});

test("read rejects deterministic growth between fstat and descriptor read", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  fs.writeFileSync(f.settings, "1234");
  const code = [
    "import importlib.util, os, sys",
    "sys.dont_write_bytecode = True",
    "spec = importlib.util.spec_from_file_location('secure_file', sys.argv[1])",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "target = sys.argv[3]",
    "original = module.read_all",
    "def grow(fd, cap):",
    "    with open(target, 'ab', buffering=0) as stream: stream.write(b'5')",
    "    return original(fd, cap)",
    "module.read_all = grow",
    "try:",
    "    module.read_target(sys.argv[2], ('.config', 'omarchy', 'omatype-settings.json'), 4)",
    "except module.BoundaryError as error:",
    "    raise SystemExit(0 if error.code == module.EXIT_UNSAFE else 2)",
    "raise SystemExit(1)"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-S", "-c", code, helper, f.home, f.settings], {
    env: {HOME: f.home, LANG: "C.UTF-8"}, encoding: "utf8", timeout: 3000
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.statSync(f.settings).size, 5);
});

test("read caps reject cap plus one and invalid UTF-8", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  fs.writeFileSync(f.settings, Buffer.from("1234"));
  assert.equal(run(f.home, "read", f.settings, 4).status, 0);
  fs.writeFileSync(f.settings, Buffer.from("12345"));
  assert.equal(run(f.home, "read", f.settings, 4).status, 4);
  fs.writeFileSync(f.settings, Buffer.from([0xff, 0xfe]));
  assert.equal(run(f.home, "read", f.settings, 4).status, 6);
});

test("write framing accepts the exact cap and rejects malformed, truncated, oversized, and invalid UTF-8 payloads", t => {
  const f = fixture(); t.after(f.cleanup);
  assert.equal(run(f.home, "write", f.settings, 4, frame("1234")).status, 0);
  const cases = [
    [Buffer.from("wat\n{}"), 7],
    [Buffer.from("4\n{}"), 7],
    [Buffer.from("5\n12345"), 7, 4],
    [Buffer.concat([Buffer.from("1\n"), Buffer.from([0xff])]), 6]
  ];
  for (const [input, expected, cap = 262144] of cases) {
    const result = run(f.home, "write", f.settings, cap, input);
    assert.equal(result.status, expected, String(result.stderr));
    assert.deepEqual(tempFiles(f.settings), []);
  }
});

test("CAS writes reject stale revisions and symlink destinations without overwriting", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  fs.writeFileSync(f.settings, "first", {mode: 0o600});
  const firstRevision = revisionOf("first");
  assert.equal(run(f.home, "write", f.settings, 262144, frame("second"), firstRevision).status, 0);
  const stale = run(f.home, "write", f.settings, 262144, frame("stale"), firstRevision);
  assert.equal(stale.status, 8, String(stale.stderr));
  assert.equal(fs.readFileSync(f.settings, "utf8"), "second");

  const target = path.join(f.home, "untouched.json");
  fs.writeFileSync(target, "untouched");
  fs.unlinkSync(f.settings);
  fs.symlinkSync(target, f.settings);
  const linkConflict = run(f.home, "write", f.settings, 262144, frame("blocked"), "absent");
  assert.equal(linkConflict.status, 8, String(linkConflict.stderr));
  assert.equal(fs.lstatSync(f.settings).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(target, "utf8"), "untouched");
});

test("write rejects group-writable path components", t => {
  const f = fixture(); t.after(f.cleanup);
  const config = path.join(f.home, ".config");
  fs.mkdirSync(config);
  fs.chmodSync(config, 0o770);
  const result = run(f.home, "write", f.settings, 262144, frame("{}"), "absent");
  assert.equal(result.status, 4, String(result.stderr));
  assert.equal(fs.existsSync(f.settings), false);
});

test("pre-rename replacement is detected without overwriting the replacement", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  fs.writeFileSync(f.settings, "original", {mode: 0o600});
  const code = [
    "import importlib.util, os, sys",
    "sys.dont_write_bytecode = True",
    "spec = importlib.util.spec_from_file_location('secure_file', sys.argv[1])",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "target = sys.argv[3]",
    "def replace(parent, name):",
    "    os.unlink(name, dir_fd=parent)",
    "    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=parent)",
    "    os.write(fd, b'replacement')",
    "    os.close(fd)",
    "module.before_publish = replace",
    "try:",
    "    module.write_target(sys.argv[2], ('.config', 'omarchy', 'omatype-settings.json'), 262144, sys.argv[4])",
    "except module.BoundaryError as error:",
    "    raise SystemExit(0 if error.code == module.EXIT_CONFLICT else 2)",
    "raise SystemExit(1)"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-S", "-c", code, helper, f.home, f.settings, revisionOf("original")], {
    env: {HOME: f.home, LANG: "C.UTF-8"}, input: frame("new"), encoding: null, timeout: 3000
  });
  assert.equal(result.status, 0, String(result.stderr));
  assert.equal(fs.readFileSync(f.settings, "utf8"), "replacement");
  assert.deepEqual(tempFiles(f.settings), []);
});

test("destination growth beyond the cap becomes a conflict before publish", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  fs.writeFileSync(f.settings, "original", {mode: 0o600});
  const code = [
    "import importlib.util, os, sys",
    "sys.dont_write_bytecode = True",
    "spec = importlib.util.spec_from_file_location('secure_file', sys.argv[1])",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "target = sys.argv[3]",
    "def grow(parent, name):",
    "    fd = os.open(name, os.O_WRONLY | os.O_APPEND, dir_fd=parent)",
    "    os.write(fd, b'x' * 262145)",
    "    os.close(fd)",
    "module.before_publish = grow",
    "try:",
    "    module.write_target(sys.argv[2], ('.config', 'omarchy', 'omatype-settings.json'), 262144, sys.argv[4])",
    "except module.BoundaryError as error:",
    "    raise SystemExit(0 if error.code == module.EXIT_CONFLICT else 2)",
    "raise SystemExit(1)"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-S", "-c", code, helper, f.home, f.settings, revisionOf("original")], {
    env: {HOME: f.home, LANG: "C.UTF-8"}, input: frame("new"), encoding: null, timeout: 3000
  });
  assert.equal(result.status, 0, String(result.stderr));
  assert.ok(fs.statSync(f.settings).size > 262144);
  assert.deepEqual(tempFiles(f.settings), []);
});

test("pre-rename parent replacement is detected without publishing into a detached directory", t => {
  const f = fixture(); t.after(f.cleanup);
  fs.mkdirSync(path.dirname(f.settings), {recursive: true});
  fs.writeFileSync(f.settings, "original", {mode: 0o600});
  const moved = path.dirname(f.settings) + "-moved";
  const code = [
    "import importlib.util, os, sys",
    "sys.dont_write_bytecode = True",
    "spec = importlib.util.spec_from_file_location('secure_file', sys.argv[1])",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "target, moved = sys.argv[3], sys.argv[4]",
    "def replace_parent(parent, name):",
    "    original = os.path.dirname(target)",
    "    os.rename(original, moved)",
    "    os.mkdir(original, 0o700)",
    "    with open(target, 'w', encoding='utf-8') as stream: stream.write('replacement')",
    "module.before_publish = replace_parent",
    "try:",
    "    module.write_target(sys.argv[2], ('.config', 'omarchy', 'omatype-settings.json'), 262144, sys.argv[5])",
    "except module.BoundaryError as error:",
    "    raise SystemExit(0 if error.code == module.EXIT_CONFLICT else 2)",
    "raise SystemExit(1)"
  ].join("\n");
  const result = spawnSync(python, ["-I", "-S", "-c", code, helper, f.home, f.settings, moved, revisionOf("original")], {
    input: frame("attacker-target"), env: {HOME: f.home, LANG: "C.UTF-8"}, encoding: "utf8", timeout: 3000
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(f.settings, "utf8"), "replacement");
  assert.equal(fs.readFileSync(path.join(moved, path.basename(f.settings)), "utf8"), "original");
  assert.deepEqual(tempFiles(path.join(moved, path.basename(f.settings))), []);
});

test("helper rejects paths, caps, and malformed expected revisions outside its allowlist", t => {
  const f = fixture(); t.after(f.cleanup);
  const other = path.join(f.home, ".config", "omarchy", "other.json");
  assert.equal(run(f.home, "write", other, 10, frame("{}" )).status, 4);
  assert.equal(run(f.home, "write", f.settings, 262145, frame("{}" )).status, 4);
  assert.equal(run(f.home, "write", f.history, 16777217, frame("{}" )).status, 4);
  assert.equal(run(f.home, "write", f.settings, 262144, frame("{}"), "not-a-revision").status, 2);
});

test("custom keyboard data has a dedicated bounded read-only-compatible target", t => {
  const f = fixture(); t.after(f.cleanup);
  const content = JSON.stringify({schemaVersion: 1, name: "Mine", layers: [{rows: [["A"]]}]});
  fs.mkdirSync(path.dirname(f.keyboard), {recursive: true});
  fs.writeFileSync(f.keyboard, content, {mode: 0o600});
  const read = run(f.home, "read", f.keyboard, 262144);
  assert.equal(read.status, 0, String(read.stderr));
  assert.equal(String(read.stdout), content);
  assert.equal(run(f.home, "write", f.keyboard, 262144, frame("{}")).status, 4);
  assert.equal(run(f.home, "read", f.keyboard, 262145).status, 4);
});
