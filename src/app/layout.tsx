import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conseal — Bulk PII Review',
  description: 'High-volume document anonymization for legal teams',
};

/**
 * Root shell — minimal chrome so Maya's queue and viewer own the viewport.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
