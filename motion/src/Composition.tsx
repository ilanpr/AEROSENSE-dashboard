import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// The phase completes a full revolution so the exported background loops seamlessly.
// Only decorative light moves: no readings or weather claims are baked into the video.
export const AtmosphereLoop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = (frame / (8 * fps)) * Math.PI * 2;
  const palette = {
    black: "#000000",
    blue: "#7499cc",
    violet: "#8c8bc5",
    ice: "#9ad6e8",
  };
  return (
    <AbsoluteFill style={{ background: palette.black, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          opacity: 0.36,
          background: `radial-gradient(ellipse at ${72 + Math.sin(phase) * 10}% ${34 + Math.cos(phase) * 10}%, ${palette.blue}, transparent 47%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 740,
          height: 240,
          right: -120,
          top: 105,
          borderRadius: "50%",
          filter: "blur(42px)",
          background: `radial-gradient(ellipse,${palette.violet},transparent 69%)`,
          opacity: 0.24,
          translate: `${Math.sin(phase) * 40}px ${Math.cos(phase) * 25}px`,
          rotate: "-28deg",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 650,
          height: 150,
          right: -80,
          top: 245,
          borderRadius: "50%",
          filter: "blur(30px)",
          background: `radial-gradient(ellipse,${palette.ice},transparent 65%)`,
          opacity: 0.2,
          translate: `${Math.cos(phase) * 30}px ${Math.sin(phase) * 20}px`,
          rotate: "-16deg",
        }}
      />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            borderRadius: "50%",
            background: palette.ice,
            left: 390 + ((i * 127) % 520),
            top: 30 + ((i * 83) % 440),
            opacity: 0.1 + (Math.sin(phase + i) + 1) * 0.12,
            translate: `0px ${Math.sin(phase + i) * 8}px`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
