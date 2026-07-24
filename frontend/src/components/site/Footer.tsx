import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-12 mt-20">
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <Link to="/" className="font-serif text-2xl italic text-primary">ProjectHub</Link>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            Premium academic resources for students.
          </p>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Contact</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Mr. Raghuraj</li>
            <li>📞 +91 9849258028</li>
            <li>
              ✉ <a href="mailto:raghuraj@hotmail.com" className="hover:text-primary">raghuraj@hotmail.com</a>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Quick Links</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li><Link to="/domains" className="hover:text-primary">Categories</Link></li>
            <li><Link to="/about" className="hover:text-primary">About</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center">
        <div className="text-xs font-mono text-muted-foreground">
          © 2026 ProjectHub. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
