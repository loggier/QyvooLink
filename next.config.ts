
import type {NextConfig} from 'next';
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});
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
      '6000-firebase-studio-1748046957632.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev',
    ],
  },
};

export default withPWA(nextConfig);