import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory using dynamic import
const loadEnv = async () => {
  const dotenv = await import("dotenv");
  dotenv.config({ path: resolve(__dirname, "..", ".env") });
};

// Call loadEnv but don't await it in the module scope
loadEnv().catch(console.error);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  turbopack: {
    root: resolve(__dirname),
  },
  // Removed: rewrites that bypassed Next.js API routes
  // All /api/v1/* requests now go through Next.js API routes for direct Firestore access
  async headers() {
    const apiOrigin = process.env.TEACHING_ASSISTANT_URL || "http://localhost:8000";
    
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.dev https://*.clerk.accounts.dev https://challenges.cloudflare.com https://www.youtube.com https://s.ytimg.com",
              // worker-src must be explicit — without it, script-src is used as fallback which blocks blob: workers (Clerk uses blob workers for auth)
              "worker-src blob: 'self'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob:",
              // wss://www.google.com is required for Chrome's Web Speech API (speech recognition WebSocket)
              `connect-src 'self' https://clerk.dev https://*.clerk.accounts.dev https://*.clerk.com wss://*.clerk.com https://api.clerk.dev ${apiOrigin} http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000 https://www.youtube.com https://www.google.com wss://www.google.com`,
              "frame-src 'self' https://clerk.dev https://*.clerk.accounts.dev https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
              "frame-ancestors 'none'",
              "media-src 'self' https: blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
