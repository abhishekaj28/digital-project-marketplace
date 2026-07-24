import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { ShieldCheck, Award, Zap, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — ProjectHub" },
      { name: "description", content: "Learn more about Your Complete Academic Resource Marketplace." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const cards = [
    { icon: BookOpen, t: "Domain-Wise Project Library", d: "Find projects categorized by subject and specialization, making it easier to explore the right academic resources." },
    { icon: Zap, t: "Instant Delivery", d: "Zero wait times. Your download link is generated the second payment succeeds." },
    { icon: ShieldCheck, t: "Verified Archives", d: "Every project report, code package, and PPT is pre-screened for quality." },
    { icon: Award, t: "Student Preferred", d: "Over 50,000 students nationwide trust ProjectHub for their academic preps." },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-16 z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="font-serif text-4xl md:text-6xl tracking-tight mb-4">
            Your Complete <br />
            <span className="italic text-primary">Academic Resource Marketplace</span>
          </h1>
          <p className="text-muted-foreground mt-6 leading-relaxed">
            ProjectHub was founded to solve a simple problem: students spend weeks hunting for high-quality project code, reports, presentation slides, and preparation questions. We consolidate these into curated, domain-specific academic bundles to value your time and grade success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {cards.map((c, i) => (
            <motion.div
              key={c.t}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="border border-border bg-card rounded-md p-8 flex gap-6"
            >
              <div className="size-12 rounded bg-primary/10 grid place-items-center text-primary shrink-0">
                <c.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-serif text-xl mb-2">{c.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.d}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-lg bg-foreground text-background p-12 relative overflow-hidden text-center max-w-3xl mx-auto">
          <div className="absolute -top-24 -right-24 size-64 bg-primary/30 blur-[100px] pointer-events-none" />
          <h2 className="font-serif text-3xl mb-4">Focus on what matters.</h2>
          <p className="opacity-70 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
            Stop scavenging search engines and building formats from scratch. Get fully-documented reference resources instantly.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
