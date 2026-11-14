export function clockOffset(sent, received, serverReceived, serverSent) {
  return (serverReceived - sent + (serverSent - received)) / 2;
}

export function envelopeFor(samples, rate, frameMs = 20) {
  const step = Math.max(1, Math.round((rate * frameMs) / 1000));
  const values = [];
  for (let start = 0; start < samples.length; start += step) {
    const end = Math.min(samples.length, start + step);
    let power = 0;
    for (let i = start; i < end; i++) power += samples[i] * samples[i];
    const rms = Math.sqrt(power / (end - start));
    values.push(Math.round(Math.min(1, Math.sqrt(Math.max(0, rms - 0.004)) * 3.8) * 1000) / 1000);
  }
  return { values, frameMs, durationMs: (samples.length / rate) * 1000 };
}

export function envelopeAt(values, frameMs, elapsed) {
  if (elapsed < 0 || elapsed >= values.length * frameMs) return 0;
  const index = elapsed / frameMs;
  const left = Math.floor(index),
    mix = index - left;
  return values[left] * (1 - mix) + (values[left + 1] || 0) * mix;
}
