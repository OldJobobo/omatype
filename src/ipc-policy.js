function utf8ByteLength(value) {
  if (typeof value !== "string") return Infinity;
  let bytes = 0;
  for (const character of Array.from(value)) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
    if (bytes > 4096) return bytes;
  }
  return bytes;
}

function parsePayload(raw) {
  if (typeof raw !== "string" || utf8ByteLength(raw) > 4096) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  } catch (_error) {
    return null;
  }
}

const api = {utf8ByteLength, parsePayload};
if (typeof module !== "undefined" && module.exports) module.exports = api;
