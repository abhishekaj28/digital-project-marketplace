import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { DomainCard } from "@/components/site/DomainCard";
import { DOMAINS, fetchDomains } from "@/lib/data";
import { Search, Gift, BookOpen, X, Check } from "lucide-react";
import { useState, useEffect } from "react";
import API from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProjectHub — Download Premium Academic Resources Instantly" },
      {
        name: "description",
        content:
          "Curated, domain-specific academic bundles — projects, notes, PPTs, viva questions and documentation. Instant download.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [domains, setDomains] = useState<any[]>(DOMAINS);
  const [loading, setLoading] = useState(DOMAINS.length === 0);
  const [promo, setPromo] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchingDomainIds, setMatchingDomainIds] = useState<string[]>([]);

  useEffect(() => {
    fetchDomains().then((res) => {
      setDomains([...res]);
      setLoading(false);
    });

    API.get("/api/book-promotion")
      .then((res) => {
        if (res.data && res.data.isEnabled) {
          setPromo(res.data);
          
          const dontShow = localStorage.getItem("ph-popup-dont-show") === "true";
          const sessionShown = sessionStorage.getItem("ph-popup-shown") === "true";
          
          if (!dontShow && !sessionShown) {
            const timer = setTimeout(() => {
              setShowPopup(true);
            }, 2000);
            return () => clearTimeout(timer);
          }
        }
      })
      .catch((err) => console.error("Error fetching book promotion:", err));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchingDomainIds([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      API.get("/api/projects", { params: { q: searchQuery } })
        .then((res) => {
          if (res.data && Array.isArray(res.data)) {
            const ids = res.data.map((p: any) => p.domainId).filter(Boolean);
            setMatchingDomainIds(ids);
          }
        })
        .catch((err) => console.error("Error searching projects:", err));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const filteredDomains = domains.filter((d) => {
    if (!searchQuery.trim()) return true;
    const matchesDomain = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = matchingDomainIds.includes(d.id);
    return matchesDomain || matchesProject;
  });

  const closePopup = () => {
    setShowPopup(false);
    sessionStorage.setItem("ph-popup-shown", "true");
    if (dontShowAgain) {
      localStorage.setItem("ph-popup-dont-show", "true");
    }
  };

  const handleUnlockOffer = () => {
    closePopup();
    const el = document.getElementById("featured-domains");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <Navbar />
      <Hero searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      {/* Large Promotional Banner below Hero Section */}
      {promo && !bannerDismissed && (
        <div className="mx-auto max-w-7xl px-6 py-4">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-r from-primary/15 via-indigo-500/10 to-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg overflow-hidden"
          >
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
            <div className="absolute -right-32 -bottom-32 size-64 bg-primary/20 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left flex-1">
              <div className="size-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-3xl animate-bounce shrink-0 shadow-inner">
                🎁
              </div>
              <div className="space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Special Promotion</div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground uppercase">
                  🎁 BUY ANY PROJECT · GET A FREE PHYSICAL BOOK
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Delivered to Your Home · No Extra Cost
                </p>
              </div>
            </div>
            
            <div className="relative flex items-center gap-4">
              <button
                onClick={() => {
                  const el = document.getElementById("featured-domains");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-3 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest rounded-md hover:opacity-90 transition-all shadow-md shadow-primary/10 flex items-center gap-2 whitespace-nowrap"
              >
                Learn More →
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-2 rounded-full hover:bg-foreground/5 text-muted-foreground transition-colors"
                title="Dismiss Banner"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <FeaturedDomains
        domains={filteredDomains}
        loading={loading}
      />
      <ContactInfo />
      <Footer />

      {/* Modern Premium Glassmorphism Welcome Popup Modal */}
      {showPopup && promo && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/40 backdrop-blur-md">
          {/* Confetti Particles (Light) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[160]">
            {Array.from({ length: 15 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  y: -20, 
                  x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 800), 
                  rotate: Math.random() * 360,
                  opacity: 0.8 
                }}
                animate={{ 
                  y: (typeof window !== "undefined" ? window.innerHeight : 800) + 20, 
                  rotate: Math.random() * 720,
                  opacity: 0 
                }}
                transition={{ 
                  duration: Math.random() * 4 + 3, 
                  ease: "linear",
                  repeat: Infinity,
                  delay: Math.random() * 2
                }}
                className="absolute size-2 rounded-sm"
                style={{
                  backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"][i % 5]
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[850px] overflow-hidden rounded-2xl border border-border/80 bg-card/90 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 text-left z-[170]"
          >
            {/* Glowing animated background dots */}
            <div className="absolute -right-20 -top-20 size-60 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 size-60 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
            
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-foreground/5 text-muted-foreground transition-colors z-20"
            >
              <X className="size-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-2">
              
              {/* Left: Floating 3D Book Illustration */}
              <div className="md:col-span-4 flex flex-col justify-center items-center shrink-0">
                <motion.div 
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-36 h-48 select-none"
                  style={{
                    perspective: '1200px',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Book 1 (Bottom, Indigo) */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-700 to-purple-600 rounded-r-md border border-white/10 flex flex-col justify-between p-3 text-white overflow-hidden shadow-2xl"
                       style={{ transform: 'rotateY(-15deg) rotateX(10deg) translateZ(0px) translateY(8px) rotate(4deg)' }}>
                    <div className="text-[7px] font-mono opacity-50">PARTNER EDITION</div>
                    <div className="my-auto font-serif text-sm font-bold leading-tight">Mastering Code</div>
                    <div className="text-[6px] font-mono opacity-50">PUBLISHING CO.</div>
                  </div>

                  {/* Book 2 (Middle, Emerald) */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-700 to-teal-500 rounded-r-md border border-white/10 flex flex-col justify-between p-3 text-white overflow-hidden shadow-2xl"
                       style={{ transform: 'rotateY(-15deg) rotateX(10deg) translateZ(15px) translateY(-2px) rotate(-2deg)' }}>
                    <div className="text-[7px] font-mono opacity-50">STUDENT BLUEPRINT</div>
                    <div className="my-auto font-serif text-sm font-bold leading-tight">Project Handbook</div>
                    <div className="text-[6px] font-mono opacity-50">PARTNER PRESS</div>
                  </div>

                  {/* Book 3 (Top, Primary Blue) */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary to-indigo-500 rounded-r-md border border-white/15 flex flex-col justify-between p-3 text-white overflow-hidden shadow-2xl"
                       style={{ transform: 'rotateY(-15deg) rotateX(10deg) translateZ(30px) translateY(-12px) rotate(1deg)' }}>
                    <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
                    <div className="text-[7px] font-mono uppercase tracking-widest opacity-80">ProjectHub</div>
                    <div className="my-auto space-y-1">
                      <div className="text-base font-serif font-bold italic leading-tight">Academic</div>
                      <div className="text-[10px] font-sans font-semibold tracking-wider uppercase opacity-85">Success Book</div>
                    </div>
                    <div className="text-[6px] font-mono opacity-60">EXCLUSIVE BONUS</div>
                  </div>
                </motion.div>
                <div className="mt-6 text-center">
                  <span className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono uppercase tracking-widest rounded-full">
                    Official Publishing Partner
                  </span>
                </div>
              </div>

              {/* Right: Content details */}
              <div className="md:col-span-8 space-y-4">
                <div className="text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2.5 mb-1.5">
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-3xl"
                    >
                      🎁
                    </motion.span>
                    <span className="font-mono text-[10px] tracking-widest uppercase font-bold text-primary">Free Physical Book</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground leading-none">
                    FREE PHYSICAL BOOK
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 font-medium">
                    Purchase Any Project Bundle and Get a FREE Book Delivered to Your Home.
                  </p>
                </div>

                {/* Premium Reward Section (Steps List) */}
                <div className="bg-muted/30 border border-border/80 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-y-3 gap-x-2 text-center text-xs">
                    <div className="flex flex-col items-center">
                      <span className="text-base">🎓</span>
                      <span className="font-semibold mt-1">Project Purchase</span>
                    </div>
                    <span className="hidden sm:inline text-muted-foreground font-bold">↓</span>
                    <div className="flex flex-col items-center">
                      <span className="text-base">📥</span>
                      <span className="font-semibold mt-1">Instant Download</span>
                    </div>
                    <span className="hidden sm:inline text-muted-foreground font-bold">↓</span>
                    <div className="flex flex-col items-center">
                      <span className="text-base">🎁</span>
                      <span className="font-semibold mt-1">Free Book Coupon</span>
                    </div>
                    <span className="hidden sm:inline text-muted-foreground font-bold">↓</span>
                    <div className="flex flex-col items-center">
                      <span className="text-base">📚</span>
                      <span className="font-semibold mt-1">Choose Any Book</span>
                    </div>
                    <span className="hidden sm:inline text-muted-foreground font-bold">↓</span>
                    <div className="flex flex-col items-center">
                      <span className="text-base">🏠</span>
                      <span className="font-semibold mt-1 text-primary font-bold">Delivered to Home</span>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    "Instant Project Download",
                    "FREE Physical Book",
                    "Home Delivery",
                    "Trusted Publishing Partner",
                    "Limited Time Offer"
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2 border border-border/60 bg-background/50 rounded-lg p-2.5 text-xs text-foreground/90 font-medium">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground bg-primary/5 border border-primary/10 rounded-md p-3 text-center sm:text-left leading-relaxed">
                  <span className="font-bold text-primary uppercase font-mono tracking-wide">Important Notice:</span> ProjectHub does not deliver books. Books are delivered directly by our Official Publishing Partner.
                </div>
              </div>
            </div>

            {/* Popup Buttons & LocalStorage Checkbox */}
            <div className="mt-6 pt-5 border-t border-border flex flex-col items-center space-y-4">
              <div className="w-full flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleUnlockOffer}
                  className="flex-1 py-3.5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md transition-all shadow-lg shadow-primary/25 text-center flex items-center justify-center gap-2"
                >
                  🎁 Unlock Free Book Offer
                </button>
                <button
                  onClick={closePopup}
                  className="flex-1 py-3.5 border border-border hover:bg-foreground/5 text-foreground text-xs font-bold uppercase tracking-widest rounded-md transition-colors text-center"
                >
                  Continue Browsing
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="size-3.5 rounded border-input text-primary focus:ring-ring"
                />
                <span>Don't show again</span>
              </label>
            </div>

          </motion.div>
        </div>
      )}
    </div>
  );
}

function ContactInfo() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16 text-center border-t border-border">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-3">
        Support
      </div>
      <h2 className="font-serif text-3xl md:text-4xl mb-6">Contact Us</h2>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-12 text-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl">📞</span>
          <span className="font-mono text-muted-foreground">+91 9849258028</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl">✉</span>
          <a href="mailto:raghuraj@hotmail.com" className="font-mono text-primary hover:underline">
            raghuraj@hotmail.com
          </a>
        </div>
      </div>
    </section>
  );
}

function Hero({ searchQuery, setSearchQuery }: { searchQuery: string; setSearchQuery: (q: string) => void }) {
  return (
    <section className="relative px-6 pt-20 pb-24 overflow-hidden">
      <div className="grain-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="relative mx-auto max-w-5xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
          className="font-serif text-5xl md:text-7xl font-medium tracking-tight text-balance leading-[1.05]"
        >
          Your Complete Academic <br />
          <span className="italic text-primary">Resource Marketplace</span>
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-6 text-xs sm:text-sm font-mono tracking-[0.25em] uppercase font-bold text-center select-none"
        >
          <span className="text-shining">
            Projects &bull; Notes &bull; Research &bull; Documentation
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-8 max-w-2xl text-base sm:text-lg text-muted-foreground text-pretty leading-relaxed"
        >
          Explore domain-wise academic projects with complete documentation, source code, PPTs, reports, and study resources—all available through a simple and secure platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-10 max-w-2xl"
        >
          <div className="flex items-center h-14 bg-card ring-1 ring-border rounded-lg shadow-sm px-4 focus-within:ring-primary transition-all">
            <Search className="size-4 text-muted-foreground mr-3" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by domain, project or technology..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturedDomains({
  domains,
  loading,
}: {
  domains: any[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-24 border-t border-border text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
          Curated Collections
        </div>
        <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight mb-6">Domains</h2>
        <div className="py-16 border border-dashed border-border rounded-md text-muted-foreground bg-card animate-pulse">
          <p className="text-lg font-medium">Loading Domains...</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section id="featured-domains" className="mx-auto max-w-7xl px-6 py-16 border-t border-border">
        <SectionHeader
          eyebrow="Curated Collections"
          title="Browse Domains"
          subtitle="Explore academic resource bundles by department."
          link={{ to: "/domains", label: `View all domains` }}
        />



        {domains.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-md bg-card">
            <p className="text-lg font-medium">No Domains Available Yet</p>
            <p className="text-sm mt-1">Admin will upload domain resource bundles for this category soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domains.map((d, i) => (
              <DomainCard key={d.id} d={d} index={i} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  link,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
          {eyebrow}
        </div>
        <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
      </div>
      {link && (
        <Link to={link.to} className="text-sm font-medium text-primary hover:underline underline-offset-4">
          {link.label} →
        </Link>
      )}
    </div>
  );
}

