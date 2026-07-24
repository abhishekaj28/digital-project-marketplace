import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { getDomainBySlug } from "@/lib/data";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

const searchSchema = z.object({
  domain: z.string().optional(),
});

export const Route = createFileRoute("/payment-cancelled")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Payment Cancelled — ProjectHub" }],
  }),
  component: CancelledPage,
});

function CancelledPage() {
  const { domain } = Route.useSearch();
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    if (domain) {
      getDomainBySlug(domain).then(setD);
    }
  }, [domain]);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Decorative premium gradients */}
      <div className="absolute -top-40 -left-40 size-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md text-center bg-card/65 backdrop-blur-lg border border-border rounded-lg p-8 md:p-10 shadow-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto mb-6 size-20 rounded-full bg-amber-500/15 border border-amber-500/20 grid place-items-center text-amber-500 shadow-lg shadow-amber-500/10"
          >
            <AlertCircle className="size-10" />
          </motion.div>

          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-2">
            Session Cancelled
          </div>
          <h1 className="font-serif text-3xl tracking-tight mb-4">Payment Cancelled</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Your payment was not completed. You closed the checkout widget before the transaction could finish. If you experienced issues, feel free to try again.
          </p>

          {d && (
            <div className="border border-border bg-background/50 rounded-md p-4 text-left space-y-2 mb-8">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono uppercase tracking-wider text-muted-foreground">Item</span>
                <span className="font-medium text-foreground">{d.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono uppercase tracking-wider text-muted-foreground">Price</span>
                <span className="font-semibold text-foreground">₹{d.price.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {d ? (
              <>
                <Link
                  to="/domains/$slug"
                  params={{ slug: d.id }}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 px-6 bg-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity shadow-md shadow-amber-500/10"
                >
                  <RotateCcw className="size-4" /> Try Again
                </Link>
                <Link
                  to="/domains/$slug"
                  params={{ slug: d.id }}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 px-6 border border-border bg-background hover:bg-accent text-xs font-bold uppercase tracking-widest rounded-sm transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Go Back
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/domains"
                  className="w-full h-12 inline-flex items-center justify-center gap-2 px-6 bg-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity shadow-md shadow-amber-500/10"
                >
                  <RotateCcw className="size-4" /> Try Again
                </Link>
                <Link
                  to="/domains"
                  className="w-full h-12 inline-flex items-center justify-center gap-2 px-6 border border-border bg-background hover:bg-accent text-xs font-bold uppercase tracking-widest rounded-sm transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Go Back
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
