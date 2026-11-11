import { loadFont } from "@remotion/google-fonts/GolosText";

// Шрифт приложения: Golos Text (в приложении подключается через next/font).
export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"], subsets: ["cyrillic", "latin"] });
