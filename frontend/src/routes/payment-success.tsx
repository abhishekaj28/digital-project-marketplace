import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, Download, ArrowLeft, FileArchive } from "lucide-react";
import { useState, useEffect } from "react";
import { getDomainBySlug, getProjectById } from "@/lib/data";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import API from "../services/api";

const searchSchema = z.object({
  txn: z.string().optional(),
  domain: z.string().optional(),
});

export const Route = createFileRoute("/payment-success")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Payment Successful — ProjectHub" }],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { txn, domain } = Route.useSearch();
  const [d, setD] = useState<any>(null);
  const [downloading, setDownloading] = useState<"idle" | "starting" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [order, setOrder] = useState<any>(null);
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const colors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"];
    const pts = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: Math.random() * 3 + 2,
      rotate: Math.random() * 360,
    }));
    setParticles(pts);
  }, []);

  useEffect(() => {
    if (domain) {
      getProjectById(domain).then((proj) => {
        if (proj) {
          setD(proj);
        } else {
          getDomainBySlug(domain).then(setD);
        }
      });
    }
  }, [domain]);

  useEffect(() => {
    if (txn) {
      API.get(`/api/orders/${txn}`)
        .then((res) => {
          setOrder(res.data);
        })
        .catch((err) => {
          console.error("Error fetching order details:", err);
        });
    }
  }, [txn]);

  const handleDownload = async (targetD?: any) => {
    const currentD = targetD || d;
    if (!currentD) return;
    setDownloading("starting");
    setProgress(10);
    try {
      const res = await API.get(`/api/download/${currentD.id}`, {
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(pct);
          } else {
            setProgress((p) => Math.min(p + 15, 95));
          }
        }
      });
      
      setProgress(100);
      setDownloading("done");

      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const downloadName = currentD.projectName 
        ? `${currentD.projectName.toLowerCase().replace(/\s+/g, '-')}-bundle.zip`
        : `${currentD.slug}-bundle.zip`;
      link.setAttribute("download", downloadName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      alert("Download failed: " + (err.response?.data?.error || "Server error"));
      setDownloading("idle");
    }
  };

  // Only auto-download if the project has actual files available
  const hasFiles = d ? (d.filesList ? d.filesList.length > 0 : (d.resourceCount > 0)) : false;

  useEffect(() => {
    if (d && downloading === "idle") {
      handleDownload(d);
    }
  }, [d]);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation-name: fall;
        }
      `}</style>

      {/* Celebration Confetti Particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[200]">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-sm animate-fall"
            style={{
              left: `${p.x}%`,
              top: `-10px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              transform: `rotate(${p.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto mb-6 size-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 grid place-items-center text-emerald-500 shadow-lg shadow-emerald-500/10"
          >
            <CheckCircle2 className="size-10 animate-pulse" />
          </motion.div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
            Payment Confirmed
          </div>
          <h1 className="font-serif text-4xl tracking-tight mb-3">🎉 Payment Successful</h1>
          <p className="text-muted-foreground mb-10">
            Your Project Purchase has been completed successfully.
          </p>

          <div className="border border-border bg-card rounded-md p-6 text-left space-y-4 mb-8">
            <Row label="Domain" value={d?.domainName || d?.name || "—"} />
            {d?.projectName && <Row label="Project" value={d.projectName} />}
            <Row label="Transaction ID" value={txn ?? "—"} mono />
            <Row label="Amount" value={d?.price !== undefined ? `₹${d.price.toLocaleString("en-IN")}` : "—"} />
            <Row label="Date" value={new Date().toLocaleDateString()} />
          </div>

          {d && (
            <div className="border border-border bg-card rounded-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded bg-primary/10 grid place-items-center text-primary">
                  <FileArchive className="size-5" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-mono text-sm truncate">
                    {d.projectName ? `${d.projectName.toLowerCase().replace(/\s+/g, '-')}-bundle.zip` : `${d.slug}-bundle.zip`}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    ZIP · {d.totalSize}
                  </div>
                </div>
              </div>

              {!hasFiles ? (
                <div className="p-4 border border-dashed border-border rounded text-center text-sm font-mono text-muted-foreground">
                  No downloadable resources are available for this project yet.
                </div>
              ) : (
                <>
                  {downloading === "idle" && (
                    <button
                      onClick={handleDownload}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90"
                    >
                      <Download className="size-4" /> Download Project ZIP
                    </button>
                  )}
                  {downloading === "starting" && (
                    <div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          animate={{ width: `${progress}%` }}
                          transition={{ ease: "linear" }}
                        />
                      </div>
                      <div className="mt-2 text-xs font-mono text-muted-foreground">
                        Downloading... {progress}%
                      </div>
                    </div>
                  )}
                  {downloading === "done" && (
                    <div className="text-sm text-primary font-medium">
                      ✓ Downloaded successfully
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {order && (order.bookUnlocked || order.bookOfferUnlocked) && (
            <div 
              className="mt-8 border border-primary/20 bg-primary/5 rounded-lg p-6 text-left space-y-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01]"
              style={{
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.08)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-indigo-500/5 blur-xl pointer-events-none" />
              
              <div className="relative space-y-1">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest font-mono">
                  <span>🎉</span>
                  <span>CONGRATULATIONS!</span>
                </div>
                <h3 className="font-serif text-2xl tracking-tight text-foreground font-bold">
                  Your FREE Physical Book has been unlocked.
                </h3>
              </div>

              {/* Premium Reward Card */}
              <div className="relative border border-border bg-background/60 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between py-2 border-b border-border/40 gap-4">
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Publisher</span>
                    <span className="font-semibold text-foreground text-sm">{order.publisherName || "Official Publishing Partner"}</span>
                  </div>
                  {order.publisherLogo ? (
                    <img 
                      src={order.publisherLogo.startsWith("http") ? order.publisherLogo : `${API.defaults.baseURL || "http://localhost:5000"}${order.publisherLogo}`} 
                      alt="Publisher Logo" 
                      className="h-10 max-w-[120px] object-contain rounded" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="text-xl">📚</div>
                  )}
                </div>

                {/* Ticket-style premium coupon design */}
                <div className="relative border border-dashed border-primary/40 bg-primary/5 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 overflow-hidden">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-card border-r border-primary/30" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-card border-l border-primary/30" />
                  
                  <div className="space-y-1 z-10 text-center sm:text-left">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Coupon Code</div>
                    <div className="font-mono text-xl sm:text-2xl font-bold bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded select-all tracking-wider">
                      {order.couponCode}
                    </div>
                  </div>

                  <div className="flex gap-2.5 z-10 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(order.couponCode);
                        alert("Coupon code copied to clipboard!");
                      }}
                      className="flex-1 sm:flex-initial px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-mono uppercase tracking-widest rounded-sm text-center flex items-center justify-center gap-1.5 border border-border transition-colors cursor-pointer"
                    >
                      <span>📋</span> Copy Coupon
                    </button>
                    <a
                      href={order.publisherWebsite || order.publisherLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial px-4 py-2.5 bg-primary text-primary-foreground hover:opacity-90 text-xs font-mono uppercase tracking-widest rounded-sm text-center flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
                    >
                      <span>📚</span> Claim Free Book
                    </a>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/40 text-xs">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Book Value</span>
                  <span className="font-mono text-xs font-bold text-foreground">₹499 - ₹999</span>
                </div>
                
                <div className="flex justify-between items-center py-2 text-xs">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Offer Status</span>
                  <span className="px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400 font-semibold">
                    Active / Unlocked
                  </span>
                </div>
              </div>

              {/* How to Claim Your FREE Book */}
              <div className="relative pt-4 border-t border-border space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-widest font-semibold text-foreground">
                  How to Claim Your FREE Book
                </h4>
                <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-2 leading-relaxed">
                  <li>Download your Project.</li>
                  <li>Click Claim Free Book.</li>
                  <li>Choose your preferred book.</li>
                  <li>Apply your Coupon Code.</li>
                  <li>Enter Shipping Address.</li>
                  <li>Publisher delivers the book.</li>
                </ol>
                <p className="text-[10px] text-muted-foreground/75 leading-relaxed pt-2 border-t border-border/50">
                  Disclaimer: ProjectHub only provides the coupon code and publisher website. Book selection, shipping, delivery and customer support are handled entirely by the publishing partner.
                </p>
              </div>
            </div>
          )}

          <Link
            to="/domains"
            className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Browse more domains
          </Link>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
