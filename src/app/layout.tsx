import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reddit Freelance Scraper',
  description: 'Scrapea subreddits en busca de ofertas freelance de programación',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
