
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
      // Regra explícita para appcliente.com na porta 8880 via HTTP
      {
        protocol: 'http',
        hostname: 'appcliente.com',
        port: '8880',
        pathname: '/**',
      },
      // Regra explícita para appcliente.com em qualquer porta via HTTP (para cobrir outros casos)
      {
        protocol: 'http',
        hostname: 'appcliente.com',
        port: '',
        pathname: '/**',
      },
      // Curinga geral para qualquer outro host HTTP
      {
        protocol: 'http',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
      // Curinga geral para qualquer outro host HTTPS
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
