import { CameraMotionBlur } from "@remotion/motion-blur";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { C, mix } from "./lib";
import { Closing, closingDark } from "./scenes/Closing";
import { Impact } from "./scenes/Impact";
import { Opening, openingBg } from "./scenes/Opening";
import { Product } from "./scenes/Product";
import { BLUR_WINDOWS, F_OUT } from "./timeline";
import { fontFamily } from "./font";

/** Кадр ролика как чистая функция номера кадра (дробный кадр допустим: так работает motion blur). */
function Frame({ offset = 0, finalOnly = false }: { offset?: number; finalOnly?: boolean }) {
  const f = useCurrentFrame() + offset;
  const bg = finalOnly ? C.night : mix(mix(C.night, C.page, openingBg(f)), C.night, closingDark(f));
  return (
    <AbsoluteFill style={{ background: bg, fontFamily, ["--font-golos" as string]: fontFamily, color: C.ink }}>
      {!finalOnly && <Opening f={f} />}
      {!finalOnly && <Product f={f} />}
      {!finalOnly && <Impact f={f} />}
      <Closing f={f} finalOnly={finalOnly} />
    </AbsoluteFill>
  );
}

const inBlur = (f: number) => BLUR_WINDOWS.some(([a, b]) => f >= a && f <= b);

export function ModusFilm({ audio = true }: { audio?: boolean }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {inBlur(f) ? (
        // Размытие собирается из 8 промежуточных положений кадра: оно точно следует за движением.
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <Frame />
        </CameraMotionBlur>
      ) : (
        <Frame />
      )}
      {audio && <Audio src={staticFile("modus-film.wav")} />}
    </AbsoluteFill>
  );
}

/** Отдельная композиция финального титра (3 секунды, без звука). */
export function ModusFinal() {
  return <Frame offset={F_OUT} finalOnly />;
}
