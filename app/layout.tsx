import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
   title: 'MISS ANTI-LOMENE · DAS CHAOS PROTOKOLL',
   description: 'Fullstack Escape Game mit Gruppenfortschritt.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="de">
         <body>{children}</body>
      </html>
   )
}
