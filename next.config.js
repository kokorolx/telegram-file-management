/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable sourcemaps in production for security and performance
  // Sourcemaps expose source code and implementation details
  // Development builds will still have sourcemaps for debugging
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY' // Prevent clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions Policy (optional but good)
          {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  }
}

export default nextConfig
