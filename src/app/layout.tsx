import type { Metadata, Viewport } from 'next';
import { ensureSeeded } from '@/lib/seed';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LORDGYM — Entrena. Progresa. Domina.',
    template: '%s · LORDGYM',
  },
  description:
    'Plataforma de entrenamiento que conecta entrenadores y deportistas: planifica, entrena, registra y analiza en un solo sitio.',
  applicationName: 'LORDGYM',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LORDGYM',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#06070a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Se permite el zoom por accesibilidad (§96).
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Siembra la biblioteca de ejercicios y la demo la primera vez que arranca.
  await ensureSeeded();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
