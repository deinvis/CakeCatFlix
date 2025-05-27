
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgscc.top',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http', // Assuming some logos might be http
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https', // Assuming some logos might be http
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'w7.pngwing.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imagizer.imageshack.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
