export function parseIrLine(line) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (value?.type !== "ir" || ![0, 1].includes(value.raw)) return null;
  if (
    typeof value.ready !== "boolean" ||
    typeof value.detected !== "boolean" ||
    typeof value.active_low !== "boolean"
  )
    return null;
  for (const key of ["seq", "uptime_ms", "pin"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > 0xffffffff) return null;
  }
  if (value.pin > 48) return null;
  return {
    type: "ir",
    seq: value.seq,
    uptime_ms: value.uptime_ms,
    pin: value.pin,
    active_low: value.active_low,
    raw: value.raw,
    ready: value.ready,
    detected: value.detected,
  };
}
