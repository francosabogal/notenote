import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'notenoté — tus ideas, en todos tus dispositivos',
  description: 'Una experiencia de notas simple, rápida y sincronizada.',
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}
