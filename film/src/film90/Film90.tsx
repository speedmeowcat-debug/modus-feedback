import { CameraMotionBlur } from "@remotion/motion-blur";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Frame } from "../film/Film";
import { fontFamily } from "../film/font";
import { C } from "../film/lib";
import { BLUR_WINDOWS } from "../film/timeline";
import { ColdOpen } from "./ColdOpen";
import { Recap } from "./Recap";
import { Roles } from "./Roles";
import { BLUR90, SEGS, remap } from "./timeline90";

const segAt = (f: number) => SEGS.find((s) => f >= s.from && f < s.to) ?? SEGS[SEGS.length - 1]!;

/** Кадр новой версии: либо новая сцена, либо кадр 60-секундного ролика со сдвигом. */
function Frame90() {
  const f = useCurrentFrame();
  const s = segAt(Math.floor(f));
  if ("scene" in s) {
    return (
      <AbsoluteFill style={{ fontFamily, ["--font-golos" as string]: fontFamily, color: C.ink }}>
        {s.scene === "cold" && <ColdOpen f={f} />}
        {s.scene === "roles" && <Roles f={f} />}
        {s.scene === "recap" && <Recap f={f} />}
      </AbsoluteFill>
    );
  }
  return <Frame offset={s.src - s.from} finalOnly={s.finalOnly} noTitle={s.noTitle} />;
}

const WINDOWS: Array<readonly [number, number]> = [
  ...BLUR90,
  ...BLUR_WINDOWS.flatMap(([a, b]) => {
    const x = remap(a);
    const y = remap(b);
    return x !== null && y !== null && y > x ? [[x, y] as const] : [];
  }),
];
const inBlur = (f: number) => WINDOWS.some(([a, b]) => f >= a && f <= b);

export function ModusFilm90({ audio = true }: { audio?: boolean }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {inBlur(f) ? (
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <Frame90 />
        </CameraMotionBlur>
      ) : (
        <Frame90 />
      )}
      {audio && <Audio src={staticFile("modus-film-90.wav")} />}
    </AbsoluteFill>
  );
}
