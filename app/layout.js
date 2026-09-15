import './globals.css'

export const metadata = {
   title: 'MISS ANTI-LOMENE · DAS CHAOS PROTOKOLL',
   description: 'Fullstack Escape Game mit Gruppenfortschritt.',
}

export default function RootLayout({ children }) {
   return (
      <html lang="de">
         <body>{children}</body>
      </html>
   )
}
