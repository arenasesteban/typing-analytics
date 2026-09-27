import { LOCAL_TYPING_CONTENT } from '@/content/typing-content';

export function AppHeader() {
    return (
        <header className="border-b border-white/6 bg-[#0b0d10]">
            <div className="mx-auto flex h-12 w-full max-w-350 items-center justify-between gap-6 px-6 lg:px-10">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]"
                    />

                    <span className="text-xs font-semibold tracking-wide whitespace-nowrap text-zinc-100">
                        Typing Analytics
                    </span>
                </div>

                <span className="border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[10px] tracking-wide text-zinc-500">
                    lang:{' '}
                    <span className="text-amber-300">{LOCAL_TYPING_CONTENT.languageLabel}</span>
                </span>
            </div>
        </header>
    );
}
