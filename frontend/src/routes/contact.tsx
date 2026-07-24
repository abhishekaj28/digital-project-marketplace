import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Phone, Mail, User } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — ProjectHub" },
      { name: "description", content: "Get in touch with Mr. Raghuraj at ProjectHub for any support queries." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-20 flex flex-col justify-center items-center">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
            Support Center
          </div>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">
            Contact Information
          </h1>
          <p className="text-muted-foreground">
            Have a question about a domain bundle or need help with a payment? Please get in touch with our support.
          </p>
        </div>

        <div className="max-w-md w-full mx-auto space-y-6">
          <div className="border border-border bg-card rounded-md p-8 shadow-sm">
            <h2 className="font-serif text-2xl mb-8 text-center">ProjectHub Support</h2>
            <div className="space-y-6">
              
              {/* Contact Person */}
              <div className="flex items-center gap-4">
                <div className="size-12 rounded bg-primary/10 grid place-items-center text-primary shrink-0">
                  <User className="size-5" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Contact Person
                  </div>
                  <div className="text-base font-sans font-semibold mt-0.5 text-foreground">
                    Mr. Raghuraj
                  </div>
                </div>
              </div>

              {/* Phone */}
              <a href="tel:+919849258028" className="flex items-center gap-4 group">
                <div className="size-12 rounded bg-primary/10 grid place-items-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Phone className="size-5" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Phone Support
                  </div>
                  <div className="text-base font-mono font-medium mt-0.5 group-hover:text-primary transition-colors">
                    +91 9849258028
                  </div>
                </div>
              </a>

              {/* Email */}
              <a href="mailto:raghuraj@hotmail.com" className="flex items-center gap-4 group">
                <div className="size-12 rounded bg-primary/10 grid place-items-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Mail className="size-5" />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Email Address
                  </div>
                  <div className="text-base font-mono font-medium mt-0.5 text-primary hover:underline">
                    raghuraj@hotmail.com
                  </div>
                </div>
              </a>


            </div>
          </div>

          <div className="border border-border bg-primary/5 rounded-md p-6 text-center">
            <h3 className="font-serif text-base mb-2 text-primary">Instant ZIP Access</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Downloads start instantly after verification. If you face any connection drop, check your purchases list to retrieve your files.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
