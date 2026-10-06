'use client';

import { IconCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type SyntheticEvent } from 'react';

import { useAuth } from '@/auth/use-auth';
import { AuthApiError } from '@/lib/auth-api';

export type AuthFormMode = 'login' | 'register';

interface AuthFormProps {
    readonly mode: AuthFormMode;
}

function getSubmitError(error: unknown, mode: AuthFormMode): string {
    if (error instanceof AuthApiError) {
        if (mode === 'login' && error.status === 401) {
            return 'Invalid email or password.';
        }

        if (mode === 'register' && error.status === 409) {
            return 'An account with this email already exists.';
        }

        if (error.status === 400) {
            return 'Check your email and password and try again.';
        }
    }

    return mode === 'login'
        ? 'Unable to sign in. Try again.'
        : 'Unable to create the account. Try again.';
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}

interface ValidationRuleProps {
    readonly satisfied: boolean;
    readonly children: string;
    readonly id: string;
}

function ValidationRule({ satisfied, children, id }: ValidationRuleProps) {
    return (
        <p
            id={id}
            className={`mt-2 flex items-center gap-2 text-xs transition-colors duration-200 ${
                satisfied ? 'text-accent' : 'text-subtle'
            }`}
        >
            <span
                aria-hidden="true"
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                    satisfied ? 'border-accent bg-accent/10' : 'border-border-strong bg-transparent'
                }`}
            >
                <IconCheck
                    size={11}
                    stroke={2.25}
                    className={`transition-opacity duration-200 ${
                        satisfied ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            </span>

            <span>{children}</span>
        </p>
    );
}

export function AuthForm({ mode }: AuthFormProps) {
    const router = useRouter();

    const { status, error: sessionError, login, register, recoverSession } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isLogin = mode === 'login';
    const isRegister = !isLogin;
    const emailRuleSatisfied = isValidEmail(email);
    const passwordRuleSatisfied = password.length >= 8 && password.length <= 128;
    const isFormValid = emailRuleSatisfied && passwordRuleSatisfied;

    useEffect(() => {
        if (status === 'authenticated') {
            router.replace('/');
        }
    }, [router, status]);

    async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        setIsSubmitting(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(email, password);
            }

            router.replace('/');
        } catch (caughtError) {
            setFormError(getSubmitError(caughtError, mode));
        } finally {
            setIsSubmitting(false);
        }
    }

    if (status === 'loading') {
        return (
            <section className="flex w-full flex-1 items-center">
                <div
                    role="status"
                    aria-live="polite"
                    className="mx-auto w-full max-w-md px-6 py-16"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">
                        authentication
                    </p>

                    <h1 className="text-foreground mt-3 text-2xl font-semibold">
                        Restoring your session
                    </h1>

                    <p className="text-muted mt-3 text-sm leading-6">
                        Checking whether this browser already has a valid authentication session.
                    </p>
                </div>
            </section>
        );
    }

    if (status === 'error') {
        return (
            <section className="flex w-full flex-1 items-center">
                <div role="alert" className="mx-auto w-full max-w-md px-6 py-16">
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">
                        authentication
                    </p>

                    <h1 className="text-foreground mt-3 text-2xl font-semibold">
                        Session recovery failed
                    </h1>

                    <p className="text-muted mt-3 text-sm leading-6">{sessionError}</p>

                    <button
                        type="button"
                        onClick={() => void recoverSession()}
                        className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent mt-8 cursor-pointer border px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        Try again
                    </button>
                </div>
            </section>
        );
    }

    if (status === 'authenticated') {
        return (
            <section className="flex w-full flex-1 items-center">
                <p role="status" aria-live="polite" className="text-muted mx-auto px-6 text-sm">
                    Redirecting…
                </p>
            </section>
        );
    }

    return (
        <section className="flex w-full flex-1 items-center">
            <div className="mx-auto w-full max-w-md px-6 py-16">
                <p className="text-accent text-xs tracking-[0.16em] uppercase">authentication</p>

                <h1 className="text-foreground mt-3 text-3xl font-semibold">
                    {isLogin ? 'Sign in' : 'Create account'}
                </h1>

                <p className="text-muted mt-3 text-sm leading-6">
                    {isLogin
                        ? 'Continue with your Typing Analytics account.'
                        : 'Create your Typing Analytics identity using email and password.'}
                </p>

                <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
                    <div>
                        <label
                            htmlFor={`${mode}-email`}
                            className="text-foreground-secondary block text-sm"
                        >
                            Email
                        </label>

                        <input
                            id={`${mode}-email`}
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                            value={email}
                            aria-describedby={isRegister ? 'register-email-rule' : undefined}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setFormError(null);
                            }}
                            className="border-border-strong bg-surface-raised text-foreground focus:border-accent/60 focus:ring-accent mt-2 w-full border px-3 py-2.5 text-sm transition-colors outline-none focus:ring-1"
                        />

                        {isRegister ? (
                            <ValidationRule id="register-email-rule" satisfied={emailRuleSatisfied}>
                                Use a valid email address.
                            </ValidationRule>
                        ) : null}
                    </div>

                    <div>
                        <label
                            htmlFor={`${mode}-password`}
                            className="text-foreground-secondary block text-sm"
                        >
                            Password
                        </label>

                        <div className="relative mt-2">
                            <input
                                id={`${mode}-password`}
                                type={isPasswordVisible ? 'text' : 'password'}
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                required
                                minLength={8}
                                maxLength={128}
                                value={password}
                                aria-describedby={isRegister ? 'register-password-rule' : undefined}
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    setFormError(null);
                                }}
                                className="border-border-strong bg-surface-raised text-foreground focus:border-accent/60 focus:ring-accent w-full border py-2.5 pr-11 pl-3 text-sm transition-colors outline-none focus:ring-1"
                            />

                            <button
                                type="button"
                                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                                aria-pressed={isPasswordVisible}
                                title={isPasswordVisible ? 'Hide password' : 'Show password'}
                                onClick={() => {
                                    setIsPasswordVisible((visible) => !visible);
                                }}
                                className="text-muted hover:text-accent focus-visible:text-accent focus-visible:ring-accent absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                {isPasswordVisible ? (
                                    <IconEyeOff size={18} stroke={1.75} aria-hidden="true" />
                                ) : (
                                    <IconEye size={18} stroke={1.75} aria-hidden="true" />
                                )}
                            </button>
                        </div>

                        {isRegister ? (
                            <ValidationRule
                                id="register-password-rule"
                                satisfied={passwordRuleSatisfied}
                            >
                                Use 8–128 characters.
                            </ValidationRule>
                        ) : null}
                    </div>

                    <div className="min-h-6">
                        {formError !== null ? (
                            <p role="alert" className="text-danger text-sm leading-6">
                                {formError}
                            </p>
                        ) : null}
                    </div>

                    <button
                        type="submit"
                        disabled={!isFormValid || isSubmitting}
                        className="border-accent/70 text-accent hover:border-accent hover:bg-accent/10 focus-visible:ring-accent disabled:hover:border-accent/70 w-full cursor-pointer border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        {isSubmitting ? 'Working…' : isLogin ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                <p className="text-muted mt-6 text-sm">
                    {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
                    <Link
                        href={isLogin ? '/register' : '/login'}
                        className="text-foreground-secondary hover:text-accent focus-visible:text-accent transition-colors focus-visible:outline-none"
                    >
                        {isLogin ? 'Register' : 'Sign in'}
                    </Link>
                </p>
            </div>
        </section>
    );
}
