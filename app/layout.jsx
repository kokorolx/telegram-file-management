import './globals.css'

export const metadata = {
  title: 'Telegram File Manager',
  description: 'Store and manage files using Telegram',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-2xl font-bold text-gray-900">📁 File Manager</h1>
              <p className="text-sm text-gray-600 mt-1">Store and manage files using Telegram</p>
            </div>
          </header>
          <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
