import { cn } from '@/lib/cn';

/** Logotipo tipográfico de LORDGYM. «GYM» va en color volt. */
export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-5xl sm:text-6xl',
    xl: 'text-6xl sm:text-8xl',
  }[size];

  return (
    <span className={cn('display inline-flex select-none items-baseline text-ink-50', sizes, className)}>
      LORD<span className="text-volt-500">GYM</span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-volt-500 text-base font-black text-ink-950',
        className,
      )}
      aria-hidden
    >
      L
    </span>
  );
}
