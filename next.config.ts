import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite и pg должны загружаться как обычные модули Node, без сборки.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Лимит вложения 5 МБ плюс поля формы.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
