'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tarjeta de selección de rol. La animación es sutil a propósito (§3):
 * un leve levantamiento y un halo que aparece al pasar el ratón o tocar.
 */
export function RoleCard({
  href,
  role,
  description,
  cta,
  icon,
  accent,
  delay = 0,
}: {
  href: string;
  role: string;
  description: string;
  cta: string;
  icon: ReactNode;
  accent: 'volt' | 'data';
  delay?: number;
}) {
  const accentClasses =
    accent === 'volt'
      ? {
          glow: 'from-volt-500/16',
          icon: 'bg-volt-500/12 text-volt-500 ring-volt-500/25',
          cta: 'bg-volt-500 text-ink-950',
        }
      : {
          glow: 'from-data-500/16',
          icon: 'bg-data-500/12 text-data-500 ring-data-500/25',
          cta: 'bg-ink-50 text-ink-950',
        };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
    >
      <Link
        href={href}
        className="card group relative block h-full overflow-hidden p-6 transition-colors hover:border-ink-600 sm:p-7"
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
            accentClasses.glow,
          )}
          aria-hidden
        />

        <div className="relative">
          <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1', accentClasses.icon)}>
            {icon}
          </span>

          <h2 className="display mt-5 text-2xl uppercase text-ink-50 sm:text-3xl">{role}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">{description}</p>

          <span
            className={cn(
              'mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-transform group-hover:scale-[1.01]',
              accentClasses.cta,
            )}
          >
            {cta}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
