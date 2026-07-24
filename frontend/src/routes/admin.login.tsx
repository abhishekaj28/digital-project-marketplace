import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { adminLogin } from "@/lib/data";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — ProjectHub" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const success = await adminLogin(email, password);
    if (success) {
      navigate({ to: "/admin" });
    } else {
      setErr("Invalid email or password");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-foreground text-background p-12 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 size-96 bg-primary/30 blur-[120px]" />
        <div className="relative">
          <Link to="/" className="font-serif text-2xl italic">ProjectHub</Link>
        </div>
        <div className="relative">
          <h1 className="font-serif text-5xl leading-tight mb-4">
            Operate the <span className="italic opacity-70">archive.</span>
          </h1>
          <p className="opacity-70 max-w-md">
            Manage domains, upload bundles, track transactions and study revenue patterns — from a single calm console.
          </p>
        </div>
        <div className="relative font-mono text-[10px] uppercase tracking-widest opacity-50">
          © 2026 ProjectHub · Admin Console
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-end p-6">
          <ThemeToggle />
        </div>
        <div className="flex-1 grid place-items-center px-6 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
              Admin Sign In
            </div>
            <h2 className="font-serif text-4xl mb-2">Welcome back</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              Sign in to manage your archive.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <Field icon={Mail} label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </Field>
              <Field icon={Lock} label="Password">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </Field>
              {err && <div className="text-xs text-destructive">{err}</div>}
              <button
                type="submit"
                className="w-full h-11 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90"
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 text-sm text-muted-foreground">
              No account?{" "}
              <Link to="/admin/register" className="text-primary hover:underline">
                Create one
              </Link>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: I,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="relative">
        <I className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        {children}
      </div>
    </label>
  );
}
