import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PurchaseModal } from "@/components/site/PurchaseModal";
import { getDomainBySlug, fetchProjectsForDomain, type Domain, type Project } from "@/lib/data";
import { Check, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { motion } from "framer-motion";
import API from "@/services/api";

export const Route = createFileRoute("/domains/$slug")({
  loader: async ({ params }) => {
    const d = await getDomainBySlug(params.slug);
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Domain Category"} — ProjectHub` },
      { name: "description", content: loaderData?.description ?? "" },
    ],
  }),
  component: DomainDetail,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="font-serif text-4xl">Domain category not found</h1>
        <Link to="/domains" className="text-primary underline mt-4 inline-block">
          Back to all domains
        </Link>
      </div>
    </div>
  ),
});

const DEFAULT_PLACEHOLDER = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop";

function normalizeImgSrc(src: string): string {
  if (!src) return DEFAULT_PLACEHOLDER;
  if (src.startsWith("http")) return src;
  const baseUrl = API.defaults.baseURL || "http://localhost:5000";
  return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}

function DomainDetail() {
  const d = Route.useLoaderData();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const PAGE_SIZE = 10;

  useEffect(() => {
    setLoading(true);
    fetchProjectsForDomain(d.id).then((res) => {
      setProjects(res);
      setLoading(false);
    });
  }, [d.id]);

  const filteredProjects = projects.filter((p) => {
    const query = q.toLowerCase().trim();
    if (!query) return true;
    return (
      (p.projectName || p.title || "").toLowerCase().includes(query) ||
      (p.description || "").toLowerCase().includes(query) ||
      (p.technologies || []).some((t) => t.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filteredProjects.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (val: string) => {
    setQ(val);
    setPage(1);
  };

  const handleBuyNow = (p: Project) => {
    setSelectedProject(p);
    setPurchaseOpen(true);
  };

  const domainThumbnail = normalizeImgSrc(d.thumbnailUrl || d.thumbnail || "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      {/* Category Header */}
      <section className="border-b border-border px-6 py-12 bg-secondary/20">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/domains"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="size-4" /> All Domains
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border border-border bg-card shrink-0 shadow-inner grid place-items-center">
              <img
                src={domainThumbnail}
                alt={d.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = DEFAULT_PLACEHOLDER; }}
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="font-serif text-4xl font-medium tracking-tight mb-3">{d.name}</h1>
              <p className="text-muted-foreground max-w-3xl leading-relaxed text-sm sm:text-base">
                {d.description || "Browse academic project bundles and files in this domain."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects List */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        {projects.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 pb-6 border-b border-border">
            <div>
              <h2 className="font-serif text-3xl font-medium tracking-tight mb-2">Available Projects</h2>
              <p className="text-muted-foreground text-sm">
                Select a project bundle below to view files, technologies, difficulty, and checkout.
              </p>
            </div>
            <div className="flex items-center h-11 bg-card ring-1 ring-border rounded-md px-4 w-full sm:max-w-[280px] focus-within:ring-primary transition-all self-end shrink-0">
              <Search className="size-4 text-muted-foreground mr-3 shrink-0" />
              <input
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search projects in this domain..."
                className="flex-1 bg-transparent outline-none text-sm w-full"
              />
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="mb-10">
            <h2 className="font-serif text-3xl font-medium tracking-tight mb-2">Available Projects</h2>
            <p className="text-muted-foreground text-sm">
              Select a project bundle below to view files, technologies, difficulty, and checkout.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-mono">
            Loading domain projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground bg-card">
            <p className="text-lg font-medium text-foreground">No projects under this domain category yet</p>
            <p className="text-sm mt-1">Admin will upload projects here soon.</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground bg-card">
            <p className="text-lg font-medium text-foreground">No projects match your search query</p>
            <p className="text-sm mt-1">Try using different keywords or tech stack terms.</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map((p, index) => {
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-border bg-card rounded-md overflow-hidden hover:border-primary/30 transition-all flex flex-col h-full group"
                >
                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-serif text-xl font-semibold group-hover:text-primary transition-colors">
                          {p.projectName}
                        </h3>
                        <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-foreground font-bold shrink-0 mt-1">
                          {p.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                        {p.description}
                      </p>

                      {/* Technologies badges */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {p.technologies.slice(0, 4).map((tech) => (
                          <span
                            key={tech}
                            className="font-mono text-[9px] uppercase tracking-wider bg-secondary/80 text-muted-foreground px-2 py-0.5 rounded-sm"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>

                      {/* Resources checkboxes/highlights */}
                      <div className="space-y-1.5 mb-6 pt-3 border-t border-border">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                          Included Resources
                        </div>
                        {p.resourcesIncluded.slice(0, 4).map((res) => (
                          <div key={res} className="flex items-center gap-2 text-xs text-foreground/90">
                            <Check className="size-3.5 text-primary shrink-0" />
                            <span className="truncate">{res}</span>
                          </div>
                        ))}
                        {p.resourcesIncluded.length > 4 && (
                          <div className="text-[10px] font-mono text-muted-foreground italic pl-5">
                            + {p.resourcesIncluded.length - 4} more resources
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Pricing & CTA */}
                    <div className="pt-4 border-t border-border flex items-center justify-between mt-auto">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Price</div>
                        <div className="text-xl font-bold font-serif text-foreground">₹{p.price.toLocaleString("en-IN")}</div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Link
                          to="/projects/$id"
                          params={{ id: p.id }}
                          className="px-3 py-2 border border-border text-foreground hover:bg-secondary text-xs uppercase tracking-wider font-mono rounded-sm transition-all inline-flex items-center gap-1 shrink-0"
                        >
                          Details <ArrowUpRight className="size-3" />
                        </Link>
                        <button
                          onClick={() => handleBuyNow(p)}
                          className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold uppercase tracking-wider rounded-sm transition-all"
                        >
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between mt-8 flex-wrap gap-3">
            <p className="text-xs text-muted-foreground font-mono">
              Showing{" "}
              <span className="text-foreground font-semibold">
                {filteredProjects.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
              </span>
              –
              <span className="text-foreground font-semibold">
                {Math.min(safePage * PAGE_SIZE, filteredProjects.length)}
              </span>
              {" "}of{" "}
              <span className="text-foreground font-semibold">{filteredProjects.length}</span> projects
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-xs font-mono font-semibold uppercase tracking-wider hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <span className="font-mono text-xs px-3 py-2 rounded-md bg-card border border-border text-foreground">
                Page {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-xs font-mono font-semibold uppercase tracking-wider hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
          </>
        )}
      </section>

      <Footer />
      
      {/* Purchase checkout modal */}
      {selectedProject && (
        <PurchaseModal
          domain={selectedProject as any} // Cast Project to Domain for purchase modal compatibility
          open={purchaseOpen}
          onClose={() => setPurchaseOpen(false)}
        />
      )}
    </div>
  );
}
