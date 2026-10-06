import type { ReactNode } from 'react';

import { ProtectedRoute } from '@/components/auth/protected-route';

interface HistoryLayoutProps {
    readonly children: ReactNode;
}

export default function HistoryLayout({ children }: HistoryLayoutProps) {
    return <ProtectedRoute>{children}</ProtectedRoute>;
}
