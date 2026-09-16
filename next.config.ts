import type { NextConfig } from "next";

// Vercel functions power the Creative Studio routes. Do not use static export:
// it cannot keep OPENAI_API_KEY on the server.
const nextConfig: NextConfig = {};
export default nextConfig;
