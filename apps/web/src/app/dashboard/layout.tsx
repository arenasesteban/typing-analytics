import type { ReactNode } from 'react';

import { ProtectedRoute } from '@/components/auth/protected-route';

interface DashboardLayoutProps {
    readonly children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return <ProtectedRoute>{children}</ProtectedRoute>;
}
