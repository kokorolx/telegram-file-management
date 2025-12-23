import './globals.css'

const siteConfig = {
  name: 'Telegram Vault',
  description: 'Ultra-secure, decentralized file storage using Telegram infrastructure and local encryption keys. Zero-knowledge by design.',
  url: 'https://tg-vault.com', // Replace with the actual URL if known
  ogImage: 'https://tg-vault.com/og-image.png',
};

export const metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    'Telegram Storage',
    'Encrypted File Manager',
    'Zero-Knowledge Storage',
    'Decentralized Cloud',
    'Secure File Sharing',
    'Private Cloud Storage',
  ],
  authors: [
    {
      name: 'kokorolx',
      url: 'https://github.com/kokorolx',
    },
  ],
  creator: 'kokorolx',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: '@kokorolx',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

import { EncryptionProvider } from './contexts/EncryptionContext';
import { UserProvider } from './contexts/UserContext';
import { ChangelogProvider } from './components/ChangelogProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#f0f4f8]">
          <UserProvider>
            <EncryptionProvider>
              <ChangelogProvider>
                {children}
              </ChangelogProvider>
            </EncryptionProvider>
          </UserProvider>
        </div>
      </body>
    </html>
  )
}
