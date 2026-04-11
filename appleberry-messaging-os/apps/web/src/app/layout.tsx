import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { AppProviders } from '../providers/app-providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Appleberry Messaging OS',
  description: 'WhatsApp campaigns, inbox, automation, and chatbot operating system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
