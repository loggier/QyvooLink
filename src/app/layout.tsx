import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { Toaster } from '@/components/ui/toaster';
import '@/polyfills';

const fontSans = Poppins({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Qyvoo - Gestión de WhatsApp',
  description: 'Sistema de gestión para WhatsApp Business',
  themeColor: '#1E88E5',
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png'
  },
  appleWebApp: {
    capable: true,
    title: 'Qyvoo',
    statusBarStyle: 'black-translucent'
  }
};

export const viewport: Viewport = {
  themeColor: '#1E88E5',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${fontSans.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html> 
  );
}
