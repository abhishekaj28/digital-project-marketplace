import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Domain } from "@/lib/data";
import API from "@/services/api";

const DEFAULT_PLACEHOLDER = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop";

function normalizeImgSrc(src: string): string {
  if (!src) return DEFAULT_PLACEHOLDER;
  if (src.startsWith("http")) return src;
  const baseUrl = API.defaults.baseURL || "http://localhost:5000";
  return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}

export function DomainCard({ d, index = 0 }: { d: Domain; index?: number }) {
  const imgSrc = normalizeImgSrc(d.thumbnailUrl || d.thumbnail || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.19, 1, 0.22, 1] }}
      className="group relative border border-border bg-card p-4 rounded-md hover:border-primary/40 transition-colors"
    >
      <div
        className="w-full aspect-[16/10] rounded-sm mb-5 grid place-items-center overflow-hidden relative bg-black"
      >
        <div className="grain-bg absolute inset-0 opacity-30" />
        <img
          src={imgSrc}
          alt={d.name}
          className="w-full h-full object-cover relative z-10"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_PLACEHOLDER;
          }}
        />
      </div>
      <div className="px-1 pb-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold">{d.name}</h3>
          <span className="font-mono text-xs text-muted-foreground mt-1">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed line-clamp-2">{d.description}</p>
        <div className="flex items-center justify-between pt-5 border-t border-border">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Project Count
            </div>
            <div className="text-lg font-medium font-serif">
              {d.count} {d.count === 1 ? "Project" : "Projects"}
            </div>
          </div>
          <Link
            to="/domains/$slug"
            params={{ slug: d.id }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity"
          >
            Explore
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
