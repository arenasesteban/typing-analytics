import { HistoryDetail } from '@/components/history/history-detail';

interface HistoryDetailPageProps {
    readonly params: Promise<{
        readonly id: string;
    }>;
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
    const { id } = await params;

    return <HistoryDetail sessionId={id} />;
}
