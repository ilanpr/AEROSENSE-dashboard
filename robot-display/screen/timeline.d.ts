export function clockOffset(
  sent: number,
  received: number,
  serverReceived: number,
  serverSent: number,
): number;
export function envelopeFor(
  samples: Float32Array,
  rate: number,
  frameMs?: number,
): { values: number[]; frameMs: number; durationMs: number };
export function envelopeAt(values: number[], frameMs: number, elapsed: number): number;
