/** @type {import("next").NextConfig} */
const nextConfig = {
  // Several approved WATI WhatsApp templates ("qist_receiving", "partial_payment",
  // etc.) have their "Complete Ledger" button baked in pointing at this frontend
  // domain (qms.qistmarket.pk/ledger/:token) instead of the backend
  // (api.qistmarket.pk/ledger/:token) that actually serves the ledger HTML —
  // re-approving those templates on WhatsApp isn't practical, so this proxies
  // the path here to the backend instead, transparently, keeping the URL on
  // this domain.
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/ledger/:token',
        destination: `${backend}/ledger/:token`,
      },
      {
        // Important Documents (PDF downloads) on the customer ledger page
        source: '/ledger/:token/document/:type',
        destination: `${backend}/ledger/:token/document/:type`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        port: ""
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: ""
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: ""
      },
      {
        protocol: "https",
        hostname: "pub-b7fd9c30cdbf439183b75041f5f71b92.r2.dev",
        port: ""
      },
      {
        protocol: 'https',
        hostname: 'qistmarket-software-backend.onrender.com',
        port: '',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowLocalIP: true,
  }
};

export default nextConfig;
