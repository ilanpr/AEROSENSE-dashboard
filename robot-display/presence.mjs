export function createPresence({ sleepAfterMs = 30000, staleAfterMs = 3000 } = {}) {
  let lastPacket = null,
    lastObject = null,
    awake = false,
    detected = null;
  return {
    update(value, now, busy = false) {
      if (typeof value !== "boolean") throw new TypeError("detected must be boolean");
      if (lastPacket === null || now - lastPacket > staleAfterMs) lastObject = now;
      lastPacket = now;
      detected = value;
      if (value) lastObject = now;
      if (busy) lastObject = now;
      if (value && !awake) {
        awake = true;
        return busy ? null : "wake";
      }
      if (!value && awake && !busy && now - lastObject >= sleepAfterMs) {
        awake = false;
        return "sleep";
      }
      return null;
    },
    state(now) {
      const online = lastPacket !== null && now - lastPacket <= staleAfterMs;
      return {
        online,
        detected: online ? detected : null,
        awake,
        idleMs: online ? Math.max(0, now - lastObject) : null,
        sleepAfterMs,
      };
    },
  };
}
