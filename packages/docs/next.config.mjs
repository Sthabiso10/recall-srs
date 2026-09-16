/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Static export.
   *
   * Everything here is client-side — the playground runs FSRS in the browser
   * against localStorage, and there are no API routes, server actions or
   * revalidation. Exporting means the site is a folder of files that any host
   * will serve, which is both cheaper and one less thing to be locked into.
   */
  output: 'export',

  // Static hosts map /docs/getting-started to a directory, so emit
  // getting-started/index.html rather than getting-started.html.
  trailingSlash: true,
  // Compile the workspace packages from source. Without this, Next serves the
  // published dist build and you have to rebuild the library on every edit.
  transpilePackages: ['@recall-srs/core', '@recall-srs/react', '@recall-srs/adapter-localstorage'],
};

export default nextConfig;
