import './globals.css'

export const metadata = {
  title: 'Telegram File Manager',
  description: 'Store and manage files using Telegram',
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
