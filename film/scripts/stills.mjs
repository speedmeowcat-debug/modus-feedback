// Проверочные кадры: один бандл, много кадров. node scripts/stills.mjs 60 250 380 ... [--scale 0.5] [--comp ModusFilmSilent]
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const scale = Number(opt("scale", "0.5"));
const compId = opt("comp", "ModusFilmSilent");
const outDir = path.resolve(opt("out", "out/stills"));
const frames = args.map(Number).filter((n) => Number.isFinite(n));
fs.mkdirSync(outDir, { recursive: true });

const here = process.cwd();
const serveUrl = await bundle({
  entryPoint: path.join(here, "src/index.ts"),
  webpackOverride: (config) => {
    const c = enableTailwind(config);
    return {
      ...c,
      resolve: {
        ...c.resolve,
        alias: {
          ...(c.resolve?.alias ?? {}),
          "@": path.join(here, "..", "src"),
          "next/link": path.join(here, "src", "film", "next-link-stub.tsx"),
          react: path.join(here, "node_modules", "react"),
          "react-dom": path.join(here, "node_modules", "react-dom"),
          "lucide-react": path.join(here, "node_modules", "lucide-react"),
        },
      },
    };
  },
});
const browser = await openBrowser("chrome", { browserExecutable: process.env.REMOTION_BROWSER ?? null });
const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser });
for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, frame, output, scale, puppeteerInstance: browser, browserExecutable: process.env.REMOTION_BROWSER ?? null });
  console.log(output);
}
await browser.close({ silent: true });
