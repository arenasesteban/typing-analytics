import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { TypingTest } from "@/components/typing-test/typing-test";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-[#090b0d] font-mono text-zinc-100">
            <AppHeader />

            <main className="flex flex-1">
                <TypingTest />
            </main>

            <AppFooter />
        </div>
    );
}