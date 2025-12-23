'use client';

import Link from 'next/link';
import { useUser } from '../contexts/UserContext';
import { useRouter } from 'next/navigation';

export default function PublicHeader({ activePage = 'home' }) {
  const { user } = useUser();
  const router = useRouter();

  const handleLaunch = (e) => {
    e.preventDefault();
    if (user) {
      router.push('/');
    } else {
      router.push('/?login=true');
    }
  };

  return (
    <nav className="fixed top-0 w-full bg-black/40 backdrop-blur-xl border-b border-white/5 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
            <img src="/logo.png" alt="Telegram Vault" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Telegram Vault</h1>
            <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Secure Storage</p>
          </div>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/landing#features" className={`text-sm font-medium transition-colors ${activePage === 'home' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-white'}`}>Features</Link>
          <Link href="/landing#security" className={`text-sm font-medium transition-colors ${activePage === 'home' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-white'}`}>Security</Link>
          <Link href="/pricing" className={`text-sm font-bold transition-colors ${activePage === 'pricing' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}>Pricing</Link>
          <button
            onClick={handleLaunch}
            className="px-5 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:bg-blue-50 transition-all active:scale-95 shadow-xl shadow-white/5 uppercase tracking-wider"
          >
            launch app
          </button>
        </div>
      </div>
    </nav>
  );
}
