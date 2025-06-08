
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
    ],
  },
  experimental: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1748046957632.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev',
      // Adding the schemeless version as reported in the error log
      '6000-firebase-studio-1748046957632.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
