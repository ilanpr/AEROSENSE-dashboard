import { Composition } from "remotion";
import { AtmosphereLoop } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Atmosphere"
        component={AtmosphereLoop}
        durationInFrames={192}
        fps={24}
        width={960}
        height={540}
      />
    </>
  );
};
