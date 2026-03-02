/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['maps.googleapis.com'],
  },
  serverExternalPackages: ['pdfjs-dist'],
};

module.exports = nextConfig;