// Экспорт общего таймлайна (кадры, звуковые события, музыка) в JSON для звукового движка.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const out = path.resolve("out/timeline.json");
const tmp = path.resolve("out/.timeline.cjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
await esbuild.build({ entryPoints: ["src/film/timeline.ts"], bundle: true, platform: "node", format: "cjs", outfile: tmp, logLevel: "error" });
const { T } = createRequire(import.meta.url)(tmp);
fs.writeFileSync(out, JSON.stringify(T.export(), null, 2));
fs.rmSync(tmp);
console.log(`timeline -> ${out} (${T.export().cues.length} звуковых событий)`);
