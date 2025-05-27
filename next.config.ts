
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
        hostname: 'placehold.co', // Keep this specific one for safety
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'appcliente.com', // Explicit rule for appcliente.com
        port: '', // Allow any port, or specify '8880' if it's always that
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**', // General wildcard for any other HTTP host
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**', // General wildcard for any other HTTPS host
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
