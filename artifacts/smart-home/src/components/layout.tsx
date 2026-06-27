import { Link } from "wouter";
import { Settings } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground dark">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50">
              <span className="text-primary font-bold">Y</span>
            </div>
            <span className="font-semibold tracking-tight">Smart Command</span>
          </div>
          <nav className="flex items-center space-x-1">
            <Link
              href="/"
              className="p-2 rounded-md transition-colors bg-primary/20 text-primary"
              data-testid="nav-engineering"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full relative">{children}</main>
    </div>
  );
}
