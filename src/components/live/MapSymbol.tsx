import { mapDrawings } from "./map-drawings";

export function MapSymbol({ kind }: { kind: keyof typeof mapDrawings }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: mapDrawings[kind] }} />;
}
