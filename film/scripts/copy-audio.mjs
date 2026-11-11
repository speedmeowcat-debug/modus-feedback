// Готовый звук кладётся в public/, откуда его читает композиция.
import fs from "node:fs";
fs.mkdirSync("public", { recursive: true });
fs.copyFileSync("out/audio.wav", "public/modus-film.wav");
console.log("out/audio.wav -> public/modus-film.wav");
