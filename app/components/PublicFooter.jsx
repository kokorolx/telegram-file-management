'use client';

import Link from 'next/link';

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/5 py-16 px-6 bg-black relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex flex-col items-center md:items-start gap-4">
          <Link href="/landing" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="text-sm">🔒</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Telegram Vault</span>
          </Link>
          <p className="text-xs text-gray-500 max-w-xs text-center md:text-left font-medium">
            Revolutionizing privacy through decentralized storage and zero-knowledge architecture.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-bold uppercase tracking-widest text-gray-500">
          <Link href="/landing" className="hover:text-white transition">Product</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <a href="https://github.com/kokorolx" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Source Code</a>
          <Link href="/" className="hover:text-white transition">Try Demo</Link>
        </div>
        <div className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">
          © 2025 ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
