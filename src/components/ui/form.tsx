'use client';

import { forwardRef, useId, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, type ButtonProps } from './button';

const CONTROL =
  'w-full rounded-xl border border-ink-700 bg-ink-900/80 px-3.5 text-ink-50 placeholder:text-ink-500 ' +
  'transition-colors focus:border-volt-500 focus:outline-none focus:ring-0 disabled:opacity-50';

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs font-medium uppercase tracking-wider text-ink-400">
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-xs text-ink-500">{hint}</p> : null}
      {error ? <p className="text-xs text-danger-500">{error}</p> : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, containerClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={containerClassName}>
      <input ref={ref} id={inputId} className={cn(CONTROL, 'h-11', className)} {...props} />
    </Field>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <textarea ref={ref} id={inputId} rows={3} className={cn(CONTROL, 'py-2.5', className)} {...props} />
    </Field>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        className={cn(CONTROL, 'h-11 appearance-none bg-[length:0] pr-9', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7488' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
        }}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});

/** Botón de envío que se deshabilita y muestra progreso durante la acción. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {pendingLabel ?? 'Guardando…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Grupo de opciones tipo segmented control, cómodo con el pulgar. */
export function OptionGroup<T extends string | number>({
  options,
  value,
  onChange,
  name,
  className,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[];
  value: T | null;
  onChange: (value: T) => void;
  name?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border font-medium transition-all active:scale-95',
              size === 'sm' ? 'h-9 min-w-9 px-3 text-sm' : 'h-11 min-w-11 px-4 text-sm',
              selected
                ? 'border-volt-500 bg-volt-500 text-ink-950'
                : 'border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-600',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
