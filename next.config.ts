
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
        hostname: 'placehold.co', // Keep this specific one for placeholders
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**', // Allows any hostname over HTTP
        port: '',       // Matches any port
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**', // Allows any hostname over HTTPS
        port: '',       // Matches any port
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
