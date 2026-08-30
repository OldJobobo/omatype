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
    legacy: path.join(home, ".local", "state", "omarchy", "omatype-settings.json"),
    history: path.join(home, ".local", "state", "omarchy", "omatype-history.json"),
    csv: path.join(home, ".local", "state", "omarchy", "omatype-history.csv"),
    cleanup() { fs.rmSync(home, {recursive: true, force: true}); }
  };
}

function run(home, operation, target, cap, input) {
  return spawnSync(python, ["-I", "-S", helper, operation, target, String(cap)], {
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

function tempFiles(target) {
  if (!fs.existsSync(path.dirname(target))) return [];
  return fs.readdirSync(path.dirname(target)).filter(name => name.startsWith("." + path.basename(target) + ".tmp-"));
}

test("secure helper writes and reads Unicode atomically with mode 0600", t => {
  const f = fixture(); t.after(f.cleanup);
  const content = JSON.stringify({label: "café λ"});
  const written = run(f.home, "write", f.settings, 262144, frame(content));
  assert.equal(written.status, 0, String(written.stderr));
  assert.equal(fs.statSync(f.settings).mode & 0o777, 0o600);
  const read = run(f.home, "read", f.settings, 262144);
  assert.equal(read.status, 0, String(read.stderr));
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

test("write framing accepts the exact cap and rejects malformed, truncated, oversized, extra, and invalid UTF-8 payloads", t => {
  const f = fixture(); t.after(f.cleanup);
  assert.equal(run(f.home, "write", f.settings, 4, frame("1234")).status, 0);
  const cases = [
    [Buffer.from("wat\n{}"), 7],
    [Buffer.from("4\n{}"), 7],
    [Buffer.from("5\n12345"), 7, 4],
    [Buffer.from("2\n{}x"), 7],
    [Buffer.concat([Buffer.from("1\n"), Buffer.from([0xff])]), 6]
  ];
  for (const [input, expected, cap = 262144] of cases) {
    const result = run(f.home, "write", f.settings, cap, input);
    assert.equal(result.status, expected, String(result.stderr));
    assert.deepEqual(tempFiles(f.settings), []);
  }
});

test("helper rejects paths and caps outside its fixed allowlist", t => {
  const f = fixture(); t.after(f.cleanup);
  const other = path.join(f.home, ".config", "omarchy", "other.json");
  assert.equal(run(f.home, "write", other, 10, frame("{}" )).status, 4);
  assert.equal(run(f.home, "write", f.settings, 262145, frame("{}" )).status, 4);
  assert.equal(run(f.home, "write", f.history, 16777217, frame("{}" )).status, 4);
});
