import { Composition } from "remotion";
import "./style.css";
import { ModusFilm, ModusFinal } from "./film/Film";
import { SCREEN_SIZE, ScreenAnalytics, ScreenCreated, ScreenForm, ScreenWorkflow } from "./film/Screens";
import { DURATION, F_OUT, FPS, H, W } from "./film/timeline";
import { ModusFilm90 } from "./film90/Film90";
import { DURATION as D90 } from "./film90/timeline90";

export function RemotionRoot() {
  return (
    <>
      <Composition id="ModusFilm" component={ModusFilm} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{ audio: true }} />
      <Composition id="ModusFilm90" component={ModusFilm90} durationInFrames={D90} fps={FPS} width={W} height={H} defaultProps={{ audio: true }} />
      <Composition id="ModusFilm90Silent" component={ModusFilm90} durationInFrames={D90} fps={FPS} width={W} height={H} defaultProps={{ audio: false }} />
      <Composition id="ModusFilmSilent" component={ModusFilm} durationInFrames={DURATION} fps={FPS} width={W} height={H} defaultProps={{ audio: false }} />
      {/* Плоские экраны для слайдов */}
      <Composition id="Screen-form" component={ScreenForm} durationInFrames={1} fps={FPS} {...SCREEN_SIZE} />
      <Composition id="Screen-created" component={ScreenCreated} durationInFrames={1} fps={FPS} width={SCREEN_SIZE.width} height={560} />
      <Composition id="Screen-workflow" component={ScreenWorkflow} durationInFrames={1} fps={FPS} {...SCREEN_SIZE} />
      <Composition id="Screen-analytics" component={ScreenAnalytics} durationInFrames={1} fps={FPS} {...SCREEN_SIZE} />
      <Composition id="ModusFinal" component={ModusFinal} durationInFrames={DURATION - F_OUT} fps={FPS} width={W} height={H} />
    </>
  );
}
