export function conditionArtUrl(scene: string) {
  return scene === "sensor-node-v3"
    ? "/assets/environment/sensor-node-v3.webp?v=20261107b"
    : `/assets/environment/pearl/${scene}.webp`;
}
