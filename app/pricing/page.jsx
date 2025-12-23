'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import ContactForm from '../components/ContactForm';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';

const CheckIcon = ({ className }) => (
  <svg className={`w-5 h-5 mx-auto ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5 mx-auto text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
  </svg>
);

export default function PricingPage() {
  const router = useRouter();
  const tiers = [
    {
      name: 'Free',
      tagline: 'Community Edition',
      price: '$0',
      description: 'For personal use and privacy hobbyists.',
      features: [
        'Unlimited Telegram Storage',
        'Zero-Knowledge Encryption',
        'Browser-Side Decryption',
        'Secure Folder Management',
        'On-the-fly Decryption',
        'Search & Tags',
        '2GB+ File Support',
        'Guest Shared Access',
      ],
      notIncluded: [
        'HD Video Streaming',
        'Personal S3/R2 Backup',
        'Recovery Security Codes',
      ],
      cta: 'Start for Free',
      href: '/',
      featured: false,
    },
    {
      name: 'Self-host',
      tagline: 'Pro Capabilities',
      price: '$0',
      unit: '/month',
      description: 'For power users needing media streaming.',
      features: [
        'Everything in Free',
        'HD Video Streaming',
        'Thumbnail Generation',
        'Personal S3/R2 Backup',
        'Master Password Recovery Codes',
        'Smart CDN Edge Caching',
        'Priority Slack Support',
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
        'Resumable Uploads',
        'Redis-backed HA Scaling',
        'Audit Logs & Compliance',
        'Role-Based Access (RBAC)',
        'Collaborative Vault Sharing',
        'White-label Options',
      ],
      cta: 'Contact Sales',
      href: '#contact',
      featured: false,
    },
  ]
 // .filter(tier => config.isEnterprise || tier.name !== 'Business');

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Navigation */}
      <PublicHeader onLaunch={() => router.push('/')} activePage="pricing" />

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

          {/* Feature Comparison Table */}
          <div className="mt-32 space-y-12">
            <div className="text-center space-y-4">
              <h3 className="text-3xl md:text-5xl font-bold italic tracking-tight">
                Compare <span className="text-blue-500">Features</span>
              </h3>
              <p className="text-gray-400 font-medium">Clear breakdown of everything we offer</p>
            </div>

            <div className="overflow-x-auto pb-8">
              <div className="min-w-[800px] bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.05]">
                      <th className="py-6 px-8 text-xs font-bold uppercase tracking-widest text-gray-500">Category / Feature</th>
                      <th className="py-6 px-8 text-center text-xs font-bold uppercase tracking-widest text-white">Free</th>
                      <th className="py-6 px-8 text-center text-xs font-bold uppercase tracking-widest text-blue-400">Self-host</th>
                      <th className="py-6 px-8 text-center text-xs font-bold uppercase tracking-widest text-indigo-400">Business</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        category: 'Storage & Encryption',
                        features: [
                          { name: 'Unlimited Telegram Storage', free: true, self: true, biz: true },
                          { name: 'Zero-Knowledge Architecture', free: true, self: true, biz: true },
                          { name: 'Local (Browser-Side) Decryption', free: true, self: true, biz: true },
                          { name: 'Vercel Edge Ready', free: true, self: true, biz: true },
                          { name: '2GB+ File Support', free: true, self: true, biz: true },
                        ]
                      },
                      {
                        category: 'Sharing & Access',
                        features: [
                          { name: 'Secure Expiring Links', free: true, self: true, biz: true },
                          { name: 'Guest Access (No Login Required)', free: true, self: true, biz: true },
                          { name: 'Password Protected Shares', free: true, self: true, biz: true },
                          { name: 'Secure Folder Management', free: true, self: true, biz: true },
                          { name: 'Collaborative Vault Sharing', free: false, self: false, biz: true },
                        ]
                      },
                      {
                        category: 'Media & Performance',
                        features: [
                          { name: 'HD Video Streaming', free: false, self: true, biz: true },
                          { name: 'Thumbnail Generation', free: false, self: true, biz: true },
                          { name: 'Smart CDN Edge Caching', free: false, self: true, biz: true },
                          { name: 'Parallel Parallel Processing', free: false, self: true, biz: true },
                        ]
                      },
                      {
                        category: 'Security & Backup',
                        features: [
                          { name: 'Master Password Recovery Codes', free: false, self: true, biz: true },
                          { name: 'Personal S3/R2 Backup', free: false, self: true, biz: true },
                          { name: 'Bot Persistence (S3 Hybrid)', free: false, false: false, biz: true },
                          { name: 'Resumable Uploads', free: false, false: false, biz: true },
                        ]
                      },
                      {
                        category: 'Enterprise & Scaling',
                        features: [
                          { name: 'Redis-backed HA Scaling', free: false, self: false, biz: true },
                          { name: 'Audit Logs & Compliance', free: false, self: false, biz: true },
                          { name: 'Role-Based Access (RBAC)', free: false, self: false, biz: true },
                          { name: 'White-label Options', free: false, self: false, biz: true },
                        ]
                      },
                    ].map((group, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="bg-white/[0.03]">
                          <td colSpan="4" className="py-4 px-8 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500/80 font-mono">
                            {group.category}
                          </td>
                        </tr>
                        {group.features.map((feature, fIdx) => (
                          <tr key={fIdx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                            <td className="py-5 px-8">
                              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{feature.name}</span>
                            </td>
                            <td className="py-5 px-8 text-center">{feature.free ? <CheckIcon className="text-emerald-500" /> : <XIcon />}</td>
                            <td className="py-5 px-8 text-center">{feature.self ? <CheckIcon className="text-blue-500" /> : <XIcon />}</td>
                            <td className="py-5 px-8 text-center">{feature.biz ? <CheckIcon className="text-indigo-500" /> : <XIcon />}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                    { q: 'Is my data really unlimited?', a: 'Yes. We provide truly unlimited storage and unlimited upload sizes. By leveraging Telegram\'s massive infrastructure, we ensure your vault has no artificial caps—store as much as you want, with files of any size.' },
                    { q: 'How does the S3 persistence work?', a: 'In the Business plan, we mirror file metadata and optionally the files themselves to your S3 bucket, ensuring availability even if a bot is restricted.' },
                    { q: 'Can I self-host the video streaming?', a: 'The Self-host tier is designed exactly for that. You provide the server, and we provide the optimized streaming engine.' }
                  ].filter(faq => config.isEnterprise || (!faq.a.includes('Business') && !faq.a.includes('Enterprise'))).map((faq, i) => (
                    <div key={i} className="group cursor-pointer">
                      <h5 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors mb-2">Q: {faq.q}</h5>
                      <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Contact Section */}
          <div id="contact" className="mt-40">
             <div className="text-center mb-16 space-y-4">
                <h3 className="text-4xl font-bold">Still have <span className="text-blue-500">questions?</span></h3>
                <p className="text-gray-400 font-medium">Our security engineers are ready to assist with your specific needs.</p>
             </div>
             <ContactForm />
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
