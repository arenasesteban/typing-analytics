export function AppFooter() {
    return (
        <footer className="border-t border-white/4">
            <div className="mx-auto flex min-h-12 w-full max-w-350 flex-col gap-2 px-6 py-3 text-[10px] uppercase tracking-[0.12em] text-zinc-600 sm:flex-row sm:items-center sm:justify-between lg:px-10">
                <p>
                    Built and designed by{" "}
                    <span className="text-zinc-300">
                        Esteban Arenas
                    </span>
                </p>

                <div
                    aria-label="Contact links coming soon"
                    className="flex flex-wrap items-center gap-4"
                >
                    <span className="cursor-default transition hover:text-amber-300">
                        GitHub
                    </span>

                    <span className="cursor-default transition hover:text-amber-300">
                        LinkedIn
                    </span>

                    <span className="cursor-default transition hover:text-amber-300">
                        Email
                    </span>
                </div>
            </div>
        </footer>
    );
}