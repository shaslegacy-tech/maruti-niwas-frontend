import type { NextConfig } from "next";

const API = process.env.API_URL ?? "http://localhost:8080";

const config: NextConfig = {
  // The browser only ever talks to this origin; Next forwards /api/* to Spring Boot.
  // That keeps the HttpOnly session cookie first-party and avoids CORS entirely.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      // Public receipt links sent on WhatsApp: https://your-site/receipt/<token> opens the PDF without login.
      { source: "/receipt/:token", destination: `${API}/api/public/receipts/:token` },
    ];
  },
};

export default config;
