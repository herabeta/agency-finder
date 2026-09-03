import type { Metadata } from 'next';
import './globals.css';
import PaginationClient from './pagination-client';

export const metadata: Metadata = {
  title: 'Agency Finder — Nigeria',
  description: 'Discover travel agencies across Nigeria.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PaginationClient /></body></html>;
}
