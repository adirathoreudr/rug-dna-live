import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'RUG DNA — Onchain Behavioral Intelligence', description: 'AI-driven onchain intelligence. Powered by GoldRush.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
