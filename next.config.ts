import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const pagesBasePath = "/discrete-cash/xds-emission";
const isStaticExport = isGitHubPages || process.env.STATIC_EXPORT === "true";
const deployBasePath = process.env.DEPLOY_BASE_PATH || pagesBasePath;

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  basePath: isStaticExport ? deployBasePath : undefined,
  assetPrefix: isStaticExport ? deployBasePath : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
