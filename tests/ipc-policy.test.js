const test = require("node:test");
const assert = require("node:assert/strict");
const IpcPolicy = require("../src/ipc-policy.js");

test("IPC parser rejects malformed, scalar, array, and oversized payloads", () => {
  assert.equal(IpcPolicy.parsePayload("{"), null);
  assert.equal(IpcPolicy.parsePayload("null"), null);
  assert.equal(IpcPolicy.parsePayload("[]"), null);
  assert.equal(IpcPolicy.parsePayload("x".repeat(4097)), null);
});

test("IPC cap counts UTF-8 bytes rather than JavaScript code units", () => {
  const oversizedUnicode = JSON.stringify({seed: "€".repeat(1400)});
  assert.ok(oversizedUnicode.length < 4096);
  assert.ok(IpcPolicy.utf8ByteLength(oversizedUnicode) > 4096);
  assert.equal(IpcPolicy.parsePayload(oversizedUnicode), null);
});

test("IPC parser accepts only bounded JSON objects", () => {
  assert.deepEqual(IpcPolicy.parsePayload("{}"), {});
  assert.deepEqual(IpcPolicy.parsePayload('{"mode":"time","amount":60}'), {mode: "time", amount: 60});
  const exact = JSON.stringify({seed: "a".repeat(4085)});
  assert.equal(IpcPolicy.utf8ByteLength(exact), 4096);
  assert.equal(IpcPolicy.parsePayload(exact).seed.length, 4085);
});
