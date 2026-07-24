import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { adminRegister } from "@/lib/data";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/register")({
  head: () => ({ meta: [{ title: "Admin Register — ProjectHub" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return setErr("All fields required");
    if (form.password !== form.confirm) return setErr("Passwords do not match");
    if (form.password.length < 6) return setErr("Password must be 6+ characters");
    
    setLoading(true);
    setErr("");
    const success = await adminRegister(form.name, form.email, form.password);
    setLoading(false);
    if (!success) return setErr("Email already registered or registration failed");
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-foreground text-background p-12 relative overflow-hidden">
        <div className="absolute -bottom-40 -left-40 size-96 bg-primary/30 blur-[120px]" />
        <div className="relative">
          <Link to="/" className="font-serif text-2xl italic">ProjectHub</Link>
        </div>
        <div className="relative">
          <h1 className="font-serif text-5xl leading-tight mb-4">
            Start curating the <span className="italic opacity-70">archive.</span>
          </h1>
          <p className="opacity-70 max-w-md">
            Create an admin account in seconds. No setup. No friction.
          </p>
        </div>
        <div className="relative font-mono text-[10px] uppercase tracking-widest opacity-50">
          © 2026 ProjectHub
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
              Create Account
            </div>
            <h2 className="font-serif text-4xl mb-2">New admin</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              Spin up an admin account for ProjectHub.
            </p>

            <form onSubmit={submit} className="space-y-4">
              {(
                [
                  ["name", "Full Name", "text"],
                  ["email", "Email", "email"],
                  ["password", "Password", "password"],
                  ["confirm", "Confirm Password", "password"],
                ] as const
              ).map(([k, label, type]) => (
                <label key={k} className="block">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                    {label}
                  </div>
                  <input
                    type={type}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </label>
              ))}
              {err && <div className="text-xs text-destructive">{err}</div>}
              <button
                type="submit"
                className="w-full h-11 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90"
              >
                Create Account
              </button>
            </form>

            <div className="mt-6 text-sm text-muted-foreground">
              Have an account?{" "}
              <Link to="/admin/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
