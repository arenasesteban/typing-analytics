import { IconBrandGithub, IconLanguage } from '@tabler/icons-react';

const REPOSITORY_URL = 'https://github.com/arenasesteban/typing-analytics';

export function AppHeader() {
    return (
        <header className="border-border border-b">
            <div className="mx-auto flex h-14 w-full max-w-350 items-center justify-between gap-6 px-6 lg:px-10">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="bg-accent-strong size-2 shrink-0 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                    />

                    <span className="text-foreground text-sm font-medium tracking-[0.06em] whitespace-nowrap sm:text-base">
                        typing-analytics
                    </span>
                </div>

                <nav aria-label="Application links" className="flex items-center gap-5 text-xs">
                    <div className="text-muted flex items-center gap-1.5">
                        <IconLanguage size={16} stroke={1.75} aria-hidden="true" />

                        <span>English</span>
                    </div>

                    <a
                        href={REPOSITORY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground-secondary hover:text-accent focus-visible:text-accent flex items-center gap-1.5 transition-colors focus-visible:outline-none"
                    >
                        <IconBrandGithub size={16} stroke={1.75} aria-hidden="true" />

                        <span className="hidden sm:inline">repository</span>
                    </a>
                </nav>
            </div>
        </header>
    );
}
