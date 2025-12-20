'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
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
              <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Secure Storage</p>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#security" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Security</a>
            <Link href="/pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</Link>
            <Link href="/" className="px-5 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:bg-blue-50 transition-all active:scale-95 shadow-xl shadow-white/5">
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative">
        {/* Hero Section */}
        <section className="pt-40 pb-32 px-6">
          <div className="max-w-7xl mx-auto text-center space-y-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 animate-fade-in">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
              Enterprise Ready v2.0
            </div>
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-[1.1] animate-fade-in-up">
              Your Data. <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-emerald-400">Your Rules.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              The first distributed, zero-knowledge vault combining the scale of Telegram with the reliability of S3.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link href="/" className="px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-blue-50 transition-all active:scale-95 shadow-2xl shadow-white/5">
                Get Started Free
              </Link>
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
                  title: 'Bot Persistence',
                  desc: 'Exclusive S3-hybrid mode keeps your data alive even if Telegram bots are restricted.',
                  icon: '⚙️',
                  color: 'indigo'
                }
              ].map((pillar, i) => (
                <div key={i} className="group p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 hover:border-blue-500/50 transition-all hover:translate-y-[-8px]">
                  <div className={`w-14 h-14 bg-${pillar.color}-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner`}>
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
                        <span className="text-5xl">🔐</span>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-4">Zero Knowledge State</p>
                     </div>
                  </div>
                  <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
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
                   <Link href="/" className="px-12 py-5 bg-white text-black rounded-full font-bold text-xl hover:scale-105 transition active:scale-95 shadow-2xl">
                    Launch Vault
                   </Link>
                </div>
             </div>
             <div className="absolute bottom-[-50%] left-[-20%] w-[100%] h-[100%] bg-black/10 rounded-full blur-[100px]"></div>
          </div>
        </section>
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
            <Link href="/landing" className="text-white">Product</Link>
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
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
