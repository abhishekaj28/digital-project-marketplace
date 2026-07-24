import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { DomainCard } from "@/components/site/DomainCard";
import { DOMAINS, fetchDomains } from "@/lib/data";
import { Search } from "lucide-react";

export const Route = createFileRoute("/domains/")({
  head: () => ({
    meta: [
      { title: "All Domains — ProjectHub" },
      { name: "description", content: "Browse all academic resource bundles by domain on ProjectHub." },
    ],
  }),
  component: DomainsPage,
});

function DomainsPage() {
  const [q, setQ] = useState("");
  const [domains, setDomains] = useState<any[]>(DOMAINS);
  const [loading, setLoading] = useState(DOMAINS.length === 0);

  useEffect(() => {
    fetchDomains().then((res) => {
      setDomains([...res]);
      setLoading(false);
    });
  }, []);

  const filtered = domains.filter((d) => {
    const matchQ =
      !q ||
      d.name.toLowerCase().includes(q.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(q.toLowerCase()));
    return matchQ;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="border-b border-border px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-3">
            The Archive · {domains.length} Domains
          </div>
          <h1 className="font-serif text-5xl md:text-6xl tracking-tight mb-4">
            Explore <span className="italic text-primary">all domains</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg">
            Every bundle includes projects, notes, PPTs, viva prep and documentation. Search by keyword.
          </p>

          <div className="mt-10 flex items-center h-12 bg-card ring-1 ring-border rounded-md px-4 max-w-md focus-within:ring-primary transition-all">
            <Search className="size-4 text-muted-foreground mr-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search domains..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        {loading ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed border-border rounded-md bg-card animate-pulse">
            <div className="font-serif text-2xl mb-2 text-foreground">Loading domains...</div>
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed border-border rounded-md bg-card">
            <div className="font-serif text-2xl mb-2 text-foreground">No Domains Available Yet</div>
            <p>Admin will upload domain resource bundles soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed border-border rounded-md bg-card">
            <div className="font-serif text-2xl mb-2 text-foreground">Nothing found</div>
            <p>Try a different keyword or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((d, i) => (
              <DomainCard key={d.id} d={d} index={i} />
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}
