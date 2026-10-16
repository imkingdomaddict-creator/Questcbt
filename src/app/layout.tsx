import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quest CBT',
  description: 'Quest College Computer Based Test Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-quest-light min-h-screen">
        {children}
      </body>
    </html>
  )
}
