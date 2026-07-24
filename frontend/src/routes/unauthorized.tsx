import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({
    meta: [
      { title: "403 Unauthorized Access — ProjectHub" },
      { name: "description", content: "You do not have permission to access this resource." },
    ],
  }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Decorative premium gradients */}
      <div className="absolute -top-40 -left-40 size-96 bg-destructive/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <header className="flex justify-end p-6 relative z-10">
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md p-8 md:p-10 rounded-lg bg-card/60 backdrop-blur-lg border border-border shadow-2xl text-center relative"
        >
          {/* Pulsing Alert Icon */}
          <div className="relative mx-auto mb-8 size-20 rounded-full bg-destructive/10 grid place-items-center text-destructive">
            <motion.div
              className="absolute inset-0 rounded-full bg-destructive/5"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            />
            <ShieldAlert className="size-10 relative z-10" />
          </div>

          <span className="font-mono text-[11px] font-bold text-destructive tracking-widest uppercase block mb-3">
            Error Code 403
          </span>
          
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-4">
            Unauthorized Access
          </h1>
          
          <p className="text-muted-foreground text-sm leading-relaxed mb-10">
            This section of the archive is locked. If you're an administrator, please sign in with your admin credentials to open this shelf.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              to="/admin/login"
              className="w-full h-12 inline-flex items-center justify-center px-6 bg-foreground text-background text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
            >
              Sign in as Admin
            </Link>
            
            <Link
              to="/"
              className="w-full h-12 inline-flex items-center justify-center gap-2 px-6 border border-border bg-background hover:bg-accent text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              <ArrowLeft className="size-4" /> Return Home
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="py-6 text-center font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
        ProjectHub Security Protocol
      </footer>
    </div>
  );
}
