/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace packages from source. Without this, Next serves the
  // published dist build and you have to rebuild the library on every edit.
  transpilePackages: ['@recall-srs/core', '@recall-srs/react', '@recall-srs/adapter-localstorage'],
};

export default nextConfig;
