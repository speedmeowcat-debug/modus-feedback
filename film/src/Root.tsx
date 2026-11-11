import { Composition } from "remotion";
import "./style.css";
import { ModusFilm, ModusFinal } from "./film/Film";
import { DURATION, F_OUT, FPS, H, W } from "./film/timeline";

export function RemotionRoot() {
  return (
    <>
      <Composition id="ModusFilm" component={ModusFilm} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{ audio: true }} />
      <Composition id="ModusFilmSilent" component={ModusFilm} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{ audio: false }} />
      <Composition id="ModusFinal" component={ModusFinal} durationInFrames={DURATION - F_OUT} fps={FPS} width={W} height={H} />
    </>
  );
}
