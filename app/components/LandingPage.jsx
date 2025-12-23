'use client';

import Link from 'next/link';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import ContactForm from './ContactForm';
import { config } from '@/lib/config';

export default function LandingPage({ onLaunch }) {
  const handleLaunch = (e) => {
    if (onLaunch) {
      e.preventDefault();
      onLaunch();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 w-full overflow-x-hidden">
      {/* Structured Data (JSON-LD) for SEO & AI Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            'name': 'Telegram Vault',
            'operatingSystem': 'Web',
            'applicationCategory': 'SecurityApplication, StorageApplication',
            'description': 'Ultra-secure, decentralized file storage using Telegram infrastructure and local encryption keys. Zero-knowledge by design.',
            'offers': {
              '@type': 'Offer',
              'price': '0',
              'priceCurrency': 'USD',
            },
            'featureList': [
              'Zero-Knowledge Encryption',
              'Unlimited Telegram Storage',
              'Browser-Side Decryption',
              'Secure Sharing',
              'Video Streaming',
            ],
            'author': {
              '@type': 'Organization',
              'name': 'Telegram Vault',
              'url': 'https://files.thnkandgrow.com',
            },
          }),
        }}
      />

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <PublicHeader onLaunch={onLaunch} activePage="home" />

      <main className="relative">
        {/* Hero Section */}
        <section className="pt-40 pb-32 px-6">
          <div className="max-w-7xl mx-auto text-center space-y-12">
            {config.isEnterprise && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 animate-fade-in">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                Enterprise Ready v2.0
              </div>
            )}
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-[1.1] animate-fade-in-up">
              Your Data. <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-emerald-400">Your Rules.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              The first distributed, zero-knowledge vault combining the scale of Telegram with the reliability of S3.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <button
                onClick={handleLaunch}
                className="px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-blue-50 transition-all active:scale-95 shadow-2xl shadow-white/5"
              >
                Get Started Free
              </button>
              <Link href="/pricing" className="px-10 py-4 bg-white/5 border border-white/10 rounded-full font-bold text-lg hover:bg-white/10 transition-all active:scale-95">
                View Pricing
              </Link>
            </div>

            {/* Platform Stats / Logos */}
            <div className="pt-24 grid grid-cols-2 md:grid-cols-4 gap-12 max-w-4xl mx-auto border-t border-white/5 grayscale opacity-50">
               <div className="flex items-center justify-center gap-2 font-bold text-lg italic">TELEGRAM</div>
               <div className="flex items-center justify-center gap-2 font-bold text-lg italic">AMAZON S3</div>
               <div className="flex items-center justify-center gap-2 font-bold text-lg italic">AES-256</div>
               <div className="flex items-center justify-center gap-2 font-bold text-lg italic">NEXT.JS</div>
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section id="features" className="py-32 px-6 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  title: 'Private by Nature',
                  desc: 'Everything is encrypted client-side. We never see your files, your keys, or your metadata.',
                  icon: '🛡️',
                  color: 'blue'
                },
                {
                  title: 'Hyper-Fast Stream',
                  desc: 'Proprietary streaming engine allows 4K video playback directly from your encrypted vault.',
                  icon: '⚡',
                  color: 'emerald'
                },
                {
                  title: 'Secure Collaboration',
                  desc: 'Share entire vaults with trusted members. Grant "contributor" access without revealing your master keys.',
                  icon: '🤝',
                  color: 'cyan'
                },
                {
                  title: 'Bot Persistence',
                  desc: 'Exclusive S3-hybrid mode keeps your data alive even if Telegram bots are restricted.',
                  icon: '⚙️',
                  color: 'indigo'
                }
              ].map((pillar, i) => (
                <div key={i} className="group p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 hover:border-blue-500/50 transition-all hover:translate-y-[-8px]">
                  <div className={`w-14 h-14 bg-${pillar.color === 'cyan' ? 'cyan' : pillar.color}-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner`}>
                    {pillar.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{pillar.title}</h3>
                  <p className="text-gray-400 leading-relaxed font-medium">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Deep-Dive */}
        <section id="security" className="py-32 px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
                Bulletproof <br />
                <span className="text-blue-500">Infrastructure.</span>
              </h2>
              <div className="space-y-6">
                {[
                  { t: 'Multi-Silo Encryption', d: 'Your files are split into parts and encrypted independently.' },
                  { t: 'Decentralized Metadata', d: 'Managed postgres with S3 backups for total disaster recovery.' },
                  { t: 'Audit-Ready', d: 'Enterprise logging monitors every interaction for compliance.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold">✓</div>
                    <div className="space-y-1">
                      <p className="font-bold text-lg">{item.t}</p>
                      <p className="text-gray-400 font-medium">{item.d}</p>
                    </div>
                  </div>
                ))}
                {config.isEnterprise && (
                  <div className="flex gap-5">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold">✓</div>
                    <div className="space-y-1">
                      <p className="font-bold text-lg">Audit-Ready</p>
                      <p className="text-gray-400 font-medium">Enterprise logging monitors every interaction for compliance.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
               <div className="aspect-square bg-gradient-to-br from-blue-600/20 to-emerald-600/10 rounded-[3rem] border border-white/10 flex items-center justify-center p-12 overflow-hidden group">
                  <div className="w-full h-full bg-black/40 backdrop-blur-3xl rounded-[2rem] border border-white/5 p-8 flex flex-col justify-between shadow-2xl transition-transform group-hover:scale-105">
                     <div className="space-y-2">
                        <div className="w-12 h-2 bg-blue-500 rounded-full"></div>
                        <div className="w-24 h-2 bg-white/10 rounded-full"></div>
                     </div>
                     <div className="font-mono text-[10px] text-gray-500 space-y-1">
                        <div className="flex justify-between"><span>AES-GCM-256</span> <span className="text-emerald-500">ENCRYPTED</span></div>
                        <div className="flex justify-between"><span>PBKDF2-SHA256</span> <span className="text-emerald-500">VERIFIED</span></div>
                        <div className="flex justify-between"><span>TLS-1.3</span> <span className="text-emerald-500">SECURE</span></div>
                     </div>
                     <div className="text-center py-6">
                        <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden mb-4 shadow-2xl shadow-blue-500/20">
                           <img src="/logo.png" alt="Vault Icon" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-4">Zero Knowledge State</p>
                     </div>
                  </div>
                  <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
               </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-32 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
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
        </section>

        {/* Final CTA */}
        <section className="py-40 px-6">
          <div className="max-w-4xl mx-auto rounded-[3.5rem] bg-gradient-to-br from-blue-600 to-indigo-800 p-12 md:p-24 text-center space-y-8 shadow-2xl shadow-blue-500/20 relative overflow-hidden">
             <div className="relative z-10 space-y-4">
                <h2 className="text-4xl md:text-6xl font-bold">Ready to take control?</h2>
                <p className="text-xl text-white/70 font-medium max-w-xl mx-auto">
                  Join the movement towards real privacy. Start your first vault in seconds.
                </p>
                <div className="pt-8">
                   <button
                    onClick={handleLaunch}
                    className="px-12 py-5 bg-white text-black rounded-full font-bold text-xl hover:scale-105 transition active:scale-95 shadow-2xl"
                   >
                    Launch Vault
                   </button>
                </div>
             </div>
             <div className="absolute bottom-[-50%] left-[-20%] w-[100%] h-[100%] bg-black/10 rounded-full blur-[100px]"></div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-32 px-6">
          <div className="max-w-7xl mx-auto flex flex-col items-center space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Establish a <span className="text-blue-500">Secure Line</span></h2>
              <p className="text-gray-400 font-medium max-w-xl mx-auto">Have questions about deployment or enterprise features? Reach out through our encrypted channel.</p>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
