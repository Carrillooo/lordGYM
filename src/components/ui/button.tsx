import { forwardRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-volt-500 text-ink-950 hover:bg-volt-400 active:bg-volt-600 font-semibold shadow-[0_8px_30px_-12px_rgba(204,255,51,0.6)]',
  secondary: 'bg-ink-750 text-ink-50 hover:bg-ink-700 border border-ink-700',
  ghost: 'text-ink-200 hover:bg-ink-800 hover:text-ink-50',
  outline: 'border border-ink-600 text-ink-100 hover:border-volt-500 hover:text-volt-500',
  danger: 'bg-danger-500/15 text-danger-500 border border-danger-500/30 hover:bg-danger-500/25',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2',
  xl: 'h-16 px-8 text-lg rounded-2xl gap-3',
};

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 ' +
  'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98] select-none';

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...props },
  ref,
) {
  return <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />;
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
