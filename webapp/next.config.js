/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Environment variables are automatically available in Next.js
  // NEXT_PUBLIC_* vars are embedded at build time
  env: {
    // Use production backend URL by default (not localhost)
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://taskforce-backend-production.up.railway.app',
    NEXT_PUBLIC_OLLAMA_URL: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434',
  },
  async rewrites() {
    // Hardcode the backend URL for production
    // This works at runtime, not just build time
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://taskforce-backend-production.up.railway.app';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

