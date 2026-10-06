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
                <AuthProvider>
                    <div className="flex min-h-screen flex-col">
                        <AppHeader />

                        <main className="flex flex-1">{children}</main>

                        <AppFooter />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
