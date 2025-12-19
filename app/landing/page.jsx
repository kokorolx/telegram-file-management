'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('features');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/50 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-900">Telegram Files Manager</h1>
              <p className="text-xs text-slate-500">Secure File Storage at Rest</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition">Features</a>
            <a href="#security" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition">Security</a>
            <a href="#opensource" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition">Open Source</a>
            <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight">
                  Unlimited File Storage<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600">
                    Secured at Rest
                  </span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Store unlimited files with military-grade encryption. Zero storage costs, maximum privacy, completely open source.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:shadow-lg hover:scale-105 transition transform text-center">
                  Launch App →
                </Link>
                <a href="#opensource" className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-lg font-bold text-lg hover:border-blue-600 hover:text-blue-600 transition text-center">
                  View Source Code
                </a>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200">
                <div>
                  <p className="text-3xl font-bold text-blue-600">∞</p>
                  <p className="text-sm text-slate-600 font-medium">Unlimited Storage</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-600">🔐</p>
                  <p className="text-sm text-slate-600 font-medium">AES-256 Encrypted</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">⚡</p>
                  <p className="text-sm text-slate-600 font-medium">Zero Latency</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-emerald-50 rounded-lg">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <p className="font-bold text-slate-900">End-to-End Encrypted</p>
                      <p className="text-xs text-slate-600">Your files, your keys</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                    <span className="text-2xl">📂</span>
                    <div>
                      <p className="font-bold text-slate-900">Organized Storage</p>
                      <p className="text-xs text-slate-600">Folders, tags, and search</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <span className="text-2xl">⚙️</span>
                    <div>
                      <p className="font-bold text-slate-900">Self-Hosted</p>
                      <p className="text-xs text-slate-600">Full control, no vendor lock-in</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <p className="font-bold text-slate-900">Lightning Fast</p>
                      <p className="text-xs text-slate-600">Instant uploads and downloads</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white/50">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">Powerful Features</h2>
            <p className="text-lg text-slate-600">Everything you need to manage files securely and efficiently</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '📤',
                title: 'Instant Upload',
                description: 'Upload files of any size with real-time progress tracking and automatic verification'
              },
              {
                icon: '🗂️',
                title: 'Smart Organization',
                description: 'Create folders, add tags, and organize files exactly how you want them'
              },
              {
                icon: '🔍',
                title: 'Advanced Search',
                description: 'Find files instantly by name, description, tags, or file type'
              },
              {
                icon: '⚡',
                title: 'One-Click Download',
                description: 'Download individual files or bulk operations with a single click'
              },
              {
                icon: '🔐',
                title: 'Encryption at Rest',
                description: 'All files encrypted with AES-256 encryption at rest on the server'
              },
              {
                icon: '📱',
                title: 'Mobile Friendly',
                description: 'Responsive design works seamlessly on phones, tablets, and desktops'
              },
              {
                icon: '📊',
                title: 'Storage Analytics',
                description: 'Track storage usage, file statistics, and access patterns'
              },
              {
                icon: '🎯',
                title: 'Bulk Operations',
                description: 'Move, delete, or organize multiple files at once'
              },
              {
                icon: '🌐',
                title: 'No Vendor Lock-in',
                description: 'Completely open source, self-hosted, and portable'
              }
            ].map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition group">
                <p className="text-3xl mb-3 group-hover:scale-110 transition">{feature.icon}</p>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900">🔒 Security First</h2>
              <p className="text-lg text-slate-600">Military-grade encryption and privacy controls built from the ground up</p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">1</span>
                    End-to-End Encryption
                  </h3>
                  <p className="text-slate-600 ml-13">Files are encrypted with AES-256 before being stored. Only you hold the decryption keys.</p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-600">2</span>
                    Zero-Knowledge Architecture
                  </h3>
                  <p className="text-slate-600 ml-13">We cannot access your files. Even our servers don&apos;t know what you&apos;re storing.</p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">3</span>
                    Self-Hosted Control
                  </h3>
                  <p className="text-slate-600 ml-13">Deploy on your own servers. No data leaves your infrastructure unless you choose to share.</p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">4</span>
                    Open Source Auditable
                  </h3>
                  <p className="text-slate-600 ml-13">Source code is publicly available for security audits and community review.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 text-white">
                  <h4 className="font-bold text-xl mb-4 flex items-center gap-2">
                    <span>🔐</span> Encryption Standards
                  </h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>AES-256-GCM</strong> for file content encryption</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>bcryptjs</strong> for password hashing (12 rounds)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>HTTPS/TLS 1.3+</strong> for all communications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>PBKDF2</strong> for key derivation</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-8 text-white">
                  <h4 className="font-bold text-xl mb-4 flex items-center gap-2">
                    <span>🛡️</span> Privacy Controls
                  </h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>No Tracking</strong> - No analytics, no telemetry</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>Local Encryption</strong> - Keys never leave your device</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>Data Minimization</strong> - We only store what&apos;s necessary</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1">✓</span>
                      <span><strong>Full Deletion</strong> - Secure wipe with no recovery option</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section id="opensource" className="py-20 px-6 bg-white/50">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">⭐ Open Source</h2>
            <p className="text-lg text-slate-600">Community-driven, transparent, and MIT licensed</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl border border-slate-200 p-8 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span>📖</span> Transparent
              </h3>
              <p className="text-slate-600">Full source code available for inspection and audit. No hidden algorithms or proprietary tricks.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-8 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span>🤝</span> Community
              </h3>
              <p className="text-slate-600">Contributions welcome. Report issues, suggest features, and help improve the project together.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-8 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span>📜</span> MIT Licensed
              </h3>
              <p className="text-slate-600">Use, modify, and distribute freely. Commercial and personal use both welcome.</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-12 text-white text-center">
            <h3 className="text-3xl font-bold mb-4">Self-Host Your Data</h3>
            <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
              Deploy Telegram Files Manager on your own servers. Whether it&apos;s your home lab, corporate infrastructure, or cloud provider—complete control is yours.
            </p>
            <div className="bg-slate-800/50 rounded-lg p-6 font-mono text-sm text-slate-200 mb-8 max-w-2xl mx-auto overflow-x-auto">
              <p>$ git clone github.com/yourusername/telegram-files-manager</p>
              <p>$ npm install && npm run setup-db</p>
              <p>$ npm run build && npm start</p>
            </div>
            <a href="https://github.com" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-lg font-bold hover:shadow-lg transition">
              <span>★</span> View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-slate-900">Built with Modern Technology</h2>
            <p className="text-lg text-slate-600">Robust, scalable, and battle-tested technologies</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Next.js 14', desc: 'React framework', icon: '⚛️' },
              { name: 'PostgreSQL', desc: 'Database', icon: '🗄️' },
              { name: 'Telegram Bot API', desc: 'File storage', icon: '📲' },
              { name: 'Tailwind CSS', desc: 'Styling', icon: '🎨' },
              { name: 'bcryptjs', desc: 'Password hashing', icon: '🔑' },
              { name: 'UUID', desc: 'Unique IDs', icon: '🆔' },
              { name: 'Zod', desc: 'Data validation', icon: '✓' },
              { name: 'Node.js', desc: 'Runtime', icon: '⚡' },
            ].map((tech, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-6 hover:border-blue-400 transition text-center">
                <p className="text-3xl mb-2">{tech.icon}</p>
                <h4 className="font-bold text-slate-900">{tech.name}</h4>
                <p className="text-sm text-slate-600">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-white/50">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Is Telegram Files Manager really free?',
                a: 'Yes, it\'s completely free and open source. The only cost is the infrastructure you host it on (if self-hosted). The MIT license allows free personal and commercial use.'
              },
              {
                q: 'How much storage can I have?',
                a: 'Unlimited storage on your own infrastructure. Storage capacity depends on your server disk space. No artificial limits imposed.'
              },
              {
                q: 'Can I run it on my own server?',
                a: 'Yes! That\'s the whole point. Deploy on any server running Node.js and PostgreSQL. Full documentation provided for setup.'
              },
              {
                q: 'Is my data really encrypted?',
                a: 'Yes. Files are encrypted with AES-256 at rest on the server. We recommend additionally encrypting files client-side before upload for maximum security.'
              },
              {
                q: 'Can I share files with others?',
                a: 'Yes. The system supports secure sharing links with optional password protection and expiration dates.'
              },
              {
                q: 'What if I need help?',
                a: 'Check the documentation, open an issue on GitHub, or contribute to improve the project. Active community support available.'
              }
            ].map((item, idx) => (
              <details key={idx} className="group border border-slate-200 rounded-lg p-6 hover:border-blue-400 cursor-pointer transition">
                <summary className="font-bold text-lg text-slate-900 group-open:text-blue-600 flex items-center justify-between">
                  {item.q}
                  <span className="text-xl group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="text-slate-600 mt-4 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-slate-900">Ready to Secure Your Files?</h2>
            <p className="text-xl text-slate-600">
              Start storing files with encryption and zero storage costs today. No credit card required.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:shadow-lg hover:scale-105 transition transform">
              Launch App Now →
            </Link>
            <a href="https://github.com/kokorolx" className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-lg font-bold text-lg hover:border-blue-600 hover:text-blue-600 transition">
              ★ Star on GitHub
            </a>
          </div>

          <p className="text-sm text-slate-600">
            🚀 Deploy in minutes. 📊 Scale infinitely. 🔒 Stay secure.
          </p>
        </div>
      </section>

      {/* Disclaimer Section */}
      <section className="py-16 px-6 bg-amber-50 border-t border-amber-200">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-amber-900 flex items-center gap-2">
              <span>⚠️</span> Important Disclaimer
            </h2>
            <p className="text-amber-800 leading-relaxed">
              Please use Telegram Files Manager responsibly. By using this system, you agree to:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-amber-200 p-6">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span>📋</span> Usage Restrictions
              </h3>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>No Adult Content:</strong> Do not upload sexually explicit materials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>No Violence:</strong> Avoid violent or harmful content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>No Illegal Content:</strong> Respect all laws and regulations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>No Piracy:</strong> Do not store pirated or copyrighted materials</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg border border-amber-200 p-6">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span>⚡</span> Telegram Limitations
              </h3>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>Files May Be Deleted:</strong> Telegram may delete files without notice</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>No Guarantee:</strong> Not a reliable long-term backup solution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>Account Risk:</strong> Account suspension may affect access</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>Keep Backups:</strong> Always maintain copies elsewhere</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-amber-200 p-6 text-center">
            <p className="text-sm text-amber-800 leading-relaxed">
              This system is provided &quot;as-is&quot; for legitimate file storage purposes only. Users are responsible for ensuring their usage complies with all applicable laws and Telegram&apos;s terms of service. The creator and hosting provider assume no liability for data loss or misuse.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6 bg-white/50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span>🔒</span> Telegram Files Manager
            </h3>
            <p className="text-sm text-slate-600">Secure file storage with unlimited capacity and encryption at rest.</p>
            <p className="text-xs text-slate-500 mt-3 font-medium">Created by <a href="https://thnkandgrow.com/about" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-semibold">Le Hoang Tam</a></p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#features" className="hover:text-blue-600 transition">Features</a></li>
              <li><a href="#security" className="hover:text-blue-600 transition">Security</a></li>
              <li><a href="#opensource" className="hover:text-blue-600 transition">Open Source</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="https://github.com/kokorolx" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition">GitHub (kokorolx)</a></li>
              <li><a href="/README.md" className="hover:text-blue-600 transition">Documentation</a></li>
              <li><a href="/SETUP.md" className="hover:text-blue-600 transition">Setup Guide</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#" className="hover:text-blue-600 transition">MIT License</a></li>
              <li><a href="#" className="hover:text-blue-600 transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-blue-600 transition">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8 text-center text-sm text-slate-600 space-y-2">
          <p>© 2025 Telegram Files Manager. Open source and MIT licensed.</p>
          <p className="text-xs">
            Built with ❤️ by <a href="https://github.com/kokorolx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-semibold">kokorolx</a> •
            <a href="https://thnkandgrow.com/about" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-semibold ml-1">Learn More</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
