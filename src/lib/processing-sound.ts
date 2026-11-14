export function startProcessingSound() {
  if (typeof AudioContext === "undefined") return () => {};
  const context = new AudioContext();
  let stopped = false;
  function tick() {
    if (stopped || context.state !== "running") return;
    [523.25, 659.25].forEach((frequency, index) => {
      const tone = context.createOscillator();
      const gain = context.createGain();
      const at = context.currentTime + index * 0.14;
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.06, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      tone.connect(gain).connect(context.destination);
      tone.start(at);
      tone.stop(at + 0.18);
    });
  }
  void context
    .resume()
    .then(tick)
    .catch(() => {});
  const timer = setInterval(tick, 3000);
  return () => {
    stopped = true;
    clearInterval(timer);
    void context.close().catch(() => {});
  };
}
