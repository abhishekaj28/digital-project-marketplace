import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PurchaseModal } from "@/components/site/PurchaseModal";
import { getProjectById, type Project } from "@/lib/data";
import { Check, FileText, Download, ArrowLeft, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import API from "@/services/api";

// @ts-ignore
export const Route = createFileRoute("/projects/$id")({
  loader: async ({ params }: any) => {
    const p = await getProjectById(params.id || params.slug);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }: any) => ({
    meta: [
      { title: `${loaderData?.projectName ?? "Project"} — ProjectHub` },
      { name: "description", content: loaderData?.description ?? "" },
    ],
  }),
  component: ProjectDetail,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="font-serif text-4xl">Project not found</h1>
        <Link to="/domains" className="text-primary underline mt-4 inline-block">
          Back to all domains
        </Link>
      </div>
    </div>
  ),
});


function ProjectDetail() {
  const p = Route.useLoaderData() as any as Project;
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [promo, setPromo] = useState<any>(null);

  useEffect(() => {
    API.get("/api/book-promotion")
      .then((res) => {
        if (res.data && res.data.isEnabled) {
          setPromo(res.data);
        }
      })
      .catch((err) => console.error("Error fetching book promotion:", err));
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="border-b border-border px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/domains/$slug"
            params={{ slug: p.domainId }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to {p.domainName || "Domain Category"}
          </Link>
          
          <div className="max-w-3xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                Project Resource Bundle
              </div>
              <h1 className="font-serif text-4xl font-medium tracking-tight mb-4">{p.projectName}</h1>
              
              {/* Technologies */}
              <div className="flex flex-wrap gap-1.5 mb-6">
                {p.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="font-mono text-[10px] uppercase tracking-wider bg-secondary text-muted-foreground px-2.5 py-1 rounded-sm border border-border"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base mb-8">
                {p.description}
              </p>

              {/* Resources Included Checkboxes */}
              <div className="mb-8 border-t border-border pt-6">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3.5">
                  Resources Included
                </div>
                {!p.resourcesIncluded || p.resourcesIncluded.length === 0 ? (
                  <p className="text-sm font-mono text-muted-foreground italic">
                    No resource checklist provided.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {p.resourcesIncluded.map((r: string) => (
                      <div key={r} className="flex items-center gap-3">
                        <div className="size-5 rounded-full bg-primary/15 grid place-items-center text-primary shrink-0">
                          <Check className="size-3" />
                        </div>
                        <span className="text-sm">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {promo && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-indigo-500/5 blur-xl pointer-events-none" />
                  <div className="relative space-y-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest font-mono">
                      <span>🎁</span>
                      <span>Bonus Unlocked</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-foreground/95">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="text-primary font-bold">✓</span> Purchase this Project
                      </div>
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="text-primary font-bold">✓</span> Unlock FREE Book Coupon
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buy block */}
              <div className="border-t border-border pt-6 flex flex-wrap items-center gap-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Price
                  </div>
                  <div className="text-3xl font-medium font-serif">₹{p.price.toLocaleString("en-IN")}</div>
                </div>
                <div className="border-l border-border pl-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Total Files Size
                  </div>
                  <div className="text-xl font-medium">{p.totalSize}</div>
                </div>
                <button
                  onClick={() => setPurchaseOpen(true)}
                  className="ml-auto inline-flex items-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90 shadow-lg shadow-primary/20"
                >
                  <Download className="size-4" /> Buy Now
                </button>
              </div>
          </div>
        </div>
      </section>

      {/* Files List and Fact Sidebar */}
      <section className="bg-secondary/20 border-b border-border px-6 py-16">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* File Lists */}
          <div className="lg:col-span-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
              Inside the package
            </div>
            <h2 className="font-serif text-3xl mb-6">Files Included ({p.filesList.length})</h2>
            <div className="bg-background border border-border rounded-md divide-y divide-border shadow-sm">
              {p.filesList.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground font-mono text-sm">
                  No resource files uploaded for this project yet.
                </div>
              ) : (
                <>
                  {p.filesList.map((f: any) => (
                    <div key={f.name} className="flex items-center justify-between p-4 hover:bg-secondary/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded bg-primary/10 grid place-items-center text-primary shrink-0">
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="font-mono text-sm truncate font-medium">{f.name}</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            {f.type} · {f.size}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Quick facts sidebar */}
          <aside className="border border-border bg-background rounded-md p-6 h-fit sticky top-24 shadow-sm">
            <div className="font-serif text-xl mb-4 text-left">Quick facts</div>
            <Stat label="Total Files" value={String(p.filesList.length)} />
            <Stat label="Total Size" value={p.totalSize} />
            <Stat label="Difficulty" value={p.difficulty} />
            <Stat label="Downloads" value={String(p.downloads)} />
            <Stat label="Access" value="Lifetime" last />
            
            {promo && (
              <div className="mt-4 p-4 border border-primary/20 bg-primary/5 rounded-md text-left space-y-1.5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-indigo-500/5 blur-xl pointer-events-none" />
                <div className="relative space-y-1.5">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest font-mono">
                    <span>🎁</span>
                    <span>BONUS REWARD</span>
                  </div>
                  <div className="space-y-1 text-xs text-foreground/90 font-medium">
                    <div>✓ Unlock FREE Physical Book</div>
                    <div>✓ Free Home Delivery</div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setPurchaseOpen(true)}
              className="mt-6 w-full px-4 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90"
            >
              Buy for ₹{p.price.toLocaleString("en-IN")}
            </button>
          </aside>
        </div>
      </section>

      <Footer />
      
      {/* Purchase checkout modal */}
      {purchaseOpen && (
        <PurchaseModal
          domain={p as any} // Cast Project to Domain for purchase modal compatibility
          open={purchaseOpen}
          onClose={() => setPurchaseOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex justify-between items-center py-3 ${last ? "" : "border-b border-border"}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
