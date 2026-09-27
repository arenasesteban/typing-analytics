import {
    IconBrandGithub,
    IconLanguage,
} from '@tabler/icons-react';

import { LOCAL_TYPING_CONTENT } from '@/content/typing-content';

const REPOSITORY_URL = 'https://github.com/arenasesteban/typing-analytics';

export function AppHeader() {
    return (
        <header className="border-b border-white/6">
            <div className="mx-auto flex h-14 w-full max-w-350 items-center justify-between gap-6 px-6 lg:px-10">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                    />

                    <span className="font-mono text-sm font-medium tracking-[0.06em] whitespace-nowrap text-zinc-100 sm:text-base">
                        typing-analytics
                    </span>
                </div>

                <nav
                    aria-label="Application links"
                    className="flex items-center gap-5 font-mono text-xs"
                >
                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <IconLanguage
                            size={16}
                            stroke={1.75}
                            aria-hidden="true"
                        />

                        <span>
                            {LOCAL_TYPING_CONTENT.languageLabel}
                        </span>
                    </div>

                    <a
                        href={REPOSITORY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-zinc-300 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300"
                    >
                        <IconBrandGithub
                            size={16}
                            stroke={1.75}
                            aria-hidden="true"
                        />

                        <span className="hidden sm:inline">
                            repository
                        </span>
                    </a>
                </nav>
            </div>
        </header>
    );
}