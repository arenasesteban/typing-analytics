import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/auth/auth-provider';
import { AppFooter } from '@/components/layout/app-footer';
import { AppHeader } from '@/components/layout/app-header';

import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Typing Analytics',
    description: 'Local typing practice with deterministic performance analysis.',
};

interface LayoutProps {
    children: ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full">
                <a
                    href="#main-content"
                    className="bg-background text-foreground focus-visible:ring-accent fixed top-3 left-3 z-100 -translate-y-24 border border-current px-4 py-2 text-sm opacity-0 transition-none focus:translate-y-0 focus:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                >
                    Skip to main content
                </a>
                <AuthProvider>
                    <div className="flex min-h-screen flex-col">
                        <AppHeader />
                        <main id="main-content" tabIndex={-1} className="flex flex-1">
                            {children}
                        </main>
                        <AppFooter />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
