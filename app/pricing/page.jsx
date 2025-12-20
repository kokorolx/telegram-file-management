'use client';

import Link from 'next/link';

export default function PricingPage() {
  const tiers = [
    {
      name: 'Free',
      tagline: 'Community Edition',
      price: '$0',
      description: 'For personal use and privacy hobbyists.',
      features: [
        'Unlimited Telegram Storage',
        'Zero-Knowledge Encryption',
        'Secure Folder Management',
        'On-the-fly Decryption',
        'Search & Tags',
        'Vercel Edge Ready',
      ],
      notIncluded: [
        'Video Streaming',
        'Background Transcoding',
        'S3 Bot Persistence',
      ],
      cta: 'Start for Free',
      href: '/',
      featured: false,
    },
    {
      name: 'Self-host',
      tagline: 'Pro Capabilities',
      price: '$19',
      unit: '/month',
      description: 'For power users needing media streaming.',
      features: [
        'Everything in Free',
        'HD Video Streaming',
        'Thumbnail Generation',
        'Custom Metadata Exports',
        'Priority Slack Support',
        'Self-hosted Auth Control',
      ],
      cta: 'Get Started Pro',
      href: '/',
      featured: true,
      badge: 'Most Popular',
    },
    {
      name: 'Business',
      tagline: 'Enterprise Grade',
      price: 'Custom',
      description: 'For teams requiring zero downtime.',
      features: [
        'Everything in Self-host',
        'Bot Persistence (S3 Hybrid)',
        'Redis-backed HA Scaling',
        'Audit Logs & Compliance',
        'Role-Based Access (RBAC)',
        'Managed Backups',
        'White-label Options',
      ],
      cta: 'Contact Sales',
      href: 'mailto:enterprise@telegramvault.com',
      featured: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/40 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <span className="text-xl">🔒</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Telegram Vault</h1>
              <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Pricing</p>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/landing#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm font-bold text-blue-400">Pricing</Link>
            <Link href="/" className="px-5 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:bg-blue-50 transition-all active:scale-95 shadow-xl shadow-white/5">
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center space-y-6 mb-20 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight">
              Ready to <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">Upgrade?</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed font-medium">
              Transparent scaling for individuals and organizations. <br className="hidden md:block" />
              Start for free, grow with confidence.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            {tiers.map((tier, i) => (
              <div
                key={i}
                className={`flex flex-col rounded-[2.5rem] p-4 p-8 transition-all duration-500 hover:translate-y-[-8px] ${
                  tier.featured
                    ? 'bg-gradient-to-b from-blue-600/20 to-indigo-600/5 border-2 border-blue-500/50 shadow-2xl shadow-blue-500/10 scale-105 z-10'
                    : 'bg-white/[0.03] border border-white/10 hover:border-white/20'
                } backdrop-blur-sm relative overflow-hidden group`}
              >
                {tier.badge && (
                  <div className="absolute top-6 right-6 px-3 py-1 bg-blue-500 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-blue-500/20">
                    {tier.badge}
                  </div>
                )}

                <div className="space-y-2 mb-8">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{tier.tagline}</span>
                  <h3 className="text-3xl font-bold">{tier.name}</h3>
                  <p className="text-gray-400 text-sm h-10">{tier.description}</p>
                </div>

                <div className="mb-10 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold tracking-tighter">{tier.price}</span>
                  {tier.unit && <span className="text-gray-500 font-medium">{tier.unit}</span>}
                </div>

                <div className="flex-1 space-y-4 mb-10">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Included Features</p>
                  <ul className="space-y-4">
                    {tier.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-gray-300">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${tier.featured ? 'bg-blue-500' : 'bg-white/10'}`}>
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                        {feature}
                      </li>
                    ))}
                    {tier.notIncluded?.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-gray-600 italic">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center border border-white/5 flex-shrink-0">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={tier.href}
                  className={`w-full py-4 rounded-2xl font-bold text-center transition-all active:scale-95 shadow-lg ${
                    tier.featured
                      ? 'bg-white text-black hover:bg-blue-50 shadow-white/5'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ / Trust Section */}
          <div className="mt-32 border-t border-white/5 pt-20">
            <div className="grid md:grid-cols-2 gap-16">
              <div className="space-y-6">
                <h4 className="text-3xl font-bold">Why choose <span className="text-blue-500">Vault?</span></h4>
                <p className="text-gray-400 leading-relaxed font-medium">
                  Traditional cloud storage is convenient but lacks true privacy. Vault combines the
                  infrastructure of Telegram with your own local encryption keys, creating a hybrid
                  system where not even we can see your data.
                </p>
                <div className="flex gap-4">
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex-1 text-center">
                      <p className="text-2xl font-bold">256-bit</p>
                      <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">AES Encryption</p>
                   </div>
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex-1 text-center">
                      <p className="text-2xl font-bold">Zero</p>
                      <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Knowledge Base</p>
                   </div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="grid gap-6">
                  {[
                    { q: 'Is my data really unlimited?', a: 'Yes. We utilize the Telegram Bot API which currently allows unlimited storage for files up to 2GB each.' },
                    { q: 'How does the S3 persistence work?', a: 'In the Business plan, we mirror file metadata and optionally the files themselves to your S3 bucket, ensuring availability even if a bot is restricted.' },
                    { q: 'Can I self-host the video streaming?', a: 'The Self-host tier is designed exactly for that. You provide the server, and we provide the optimized streaming engine.' }
                  ].map((faq, i) => (
                    <div key={i} className="group cursor-pointer">
                      <h5 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors mb-2">Q: {faq.q}</h5>
                      <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16 px-6 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link href="/landing" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-sm">🔒</span>
              </div>
              <span className="font-bold text-lg tracking-tight">Telegram Vault</span>
            </Link>
            <p className="text-xs text-gray-500 max-w-xs text-center md:text-left font-medium">
              Revolutionizing privacy through decentralized storage and zero-knowledge architecture.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-bold uppercase tracking-widest text-gray-500">
            <Link href="/landing" className="hover:text-white transition">Product</Link>
            <Link href="/pricing" className="text-blue-500">Pricing</Link>
            <a href="https://github.com/kokorolx" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Source Code</a>
            <Link href="/" className="hover:text-white transition">Try Demo</Link>
          </div>
          <div className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">
            © 2025 ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </div>
  );
}
