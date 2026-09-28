import { IconBrandGithub, IconBrandLinkedin } from '@tabler/icons-react';

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
        <footer className="border-border border-t">
            <div className="text-muted mx-auto flex min-h-14 w-full max-w-350 flex-col gap-3 px-6 py-4 text-xs sm:flex-row sm:items-center sm:justify-between lg:px-10">
                <p>
                    Built and designed by{' '}
                    <span className="text-foreground-secondary">Esteban Arenas</span>
                </p>

                <nav aria-label="Contact links" className="flex flex-wrap items-center gap-5">
                    {CONTACT_LINKS.map(({ label, href, icon: Icon }) => (
                        <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted hover:text-accent focus-visible:text-accent flex items-center gap-1.5 transition-colors focus-visible:outline-none"
                        >
                            <Icon size={16} stroke={1.75} aria-hidden="true" />

                            <span>{label}</span>
                        </a>
                    ))}
                </nav>
            </div>
        </footer>
    );
}
