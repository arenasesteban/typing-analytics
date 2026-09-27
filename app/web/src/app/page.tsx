import { TYPING_CORE_PACKAGE_NAME } from '@typing-analytics/typing-core';

export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
            <section className="space-y-3 text-center">
                <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase">Typing Analytics</p>

                <h1 className="text-3xl font-semibold">Application baseline</h1>

                <p className="text-zinc-400">
                    Web workspace connected to{' '}
                    <code className="text-zinc-200">{TYPING_CORE_PACKAGE_NAME}</code>.
                </p>
            </section>
        </main>
    );
}
