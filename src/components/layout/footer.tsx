
import Link from 'next/link';

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full shrink-0 border-t bg-background">
      <div className="container mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-sm text-muted-foreground gap-2">
        <p className="text-center sm:text-left">
          Copyright &copy; {currentYear}{' '}
          <a
            href="https://www.vemontech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Vemontech
          </a>
          .
        </p>
        <nav className="flex items-center gap-4 sm:gap-6">
          <a
            href="https://qyvoo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline"
          >
            Qyvoo.com
          </a>
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
            Términos
          </Link>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
            Privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}
