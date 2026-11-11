import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setConcurrency(null);

// На Windows путь к встроенному Chrome Headless Shell может превысить 260 символов.
// Тогда укажите копию браузера по короткому пути: REMOTION_BROWSER=C:\path\chrome-headless-shell.exe
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
// То же для ffmpeg из @remotion/compositor-*: REMOTION_BINARIES=C:\path	o\compositor-folder
if (process.env.REMOTION_BINARIES) Config.setBinariesDirectory(process.env.REMOTION_BINARIES);

// Ролик использует настоящие компоненты и дизайн-токены приложения (../src).
// Их импорты (@/…, next/link, react) перенаправляются в окружение Remotion.
Config.overrideWebpackConfig((config) => {
  const withTw = enableTailwind(config);
  const here = process.cwd();
  return {
    ...withTw,
    resolve: {
      ...withTw.resolve,
      alias: {
        ...(withTw.resolve?.alias ?? {}),
        "@": path.join(here, "..", "src"),
        "next/link": path.join(here, "src", "film", "next-link-stub.tsx"),
        react: path.join(here, "node_modules", "react"),
        "react-dom": path.join(here, "node_modules", "react-dom"),
        "lucide-react": path.join(here, "node_modules", "lucide-react"),
      },
    },
  };
});
