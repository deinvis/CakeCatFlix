
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co', // Keep this specific one for safety as it's used for placeholders
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**', // Allow any hostname over HTTP
        port: '', // Allow any port
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**', // Allow any hostname over HTTPS
        port: '', // Allow any port
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
