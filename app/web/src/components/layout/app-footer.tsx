import {
    IconBrandGithub,
    IconBrandLinkedin,
} from '@tabler/icons-react';

const CONTACT_LINKS = [
    {
        label: 'GitHub',
        href: 'https://github.com/arenasesteban',
        icon: IconBrandGithub,
    },
    {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/in/arenasesteban/',
        icon: IconBrandLinkedin,
    },
] as const;

export function AppFooter() {
    return (
        <footer className="border-t border-white/5">
            <div className="mx-auto flex min-h-14 w-full max-w-350 flex-col gap-3 px-6 py-4 font-mono text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between lg:px-10">
                <p>
                    Built and designed by{' '}
                    <span className="text-zinc-300">
                        Esteban Arenas
                    </span>
                </p>

                <nav
                    aria-label="Contact links"
                    className="flex flex-wrap items-center gap-5"
                >
                    {CONTACT_LINKS.map(
                        ({ label, href, icon: Icon }) => (
                            <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300"
                            >
                                <Icon
                                    size={16}
                                    stroke={1.75}
                                    aria-hidden="true"
                                />

                                <span>{label}</span>
                            </a>
                        ),
                    )}
                </nav>
            </div>
        </footer>
    );
}