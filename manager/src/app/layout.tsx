import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegistrarSW } from '@/components/registrar-sw';

export const metadata: Metadata = {
  title: { default: 'MAS3D Manager', template: '%s · MAS3D' },
  description: 'Centro de operaciones de MAS3D: pedidos, clientes y finanzas.',
  applicationName: 'MAS3D Manager',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/brand/favicon-64.png', apple: '/brand/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'MAS3D', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#fbf4ea',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC">
      <body className="min-h-dvh antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
