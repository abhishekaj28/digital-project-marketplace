import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      {/* Main Navbar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-serif text-2xl font-semibold italic tracking-tight text-primary">
            ProjectHub
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              Home
            </Link>
            <Link
              to="/domains"
              className="hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              Categories
            </Link>
            <Link
              to="/about"
              className="hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-semibold" }}
            >
              Contact Us
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mobile navigation fallback for small screens */}
          <div className="md:hidden flex gap-4 text-xs font-medium text-muted-foreground mr-2">
            <Link to="/domains" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
              Explore
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
