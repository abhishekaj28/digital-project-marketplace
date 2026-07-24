import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { getPurchases } from "@/lib/data";
import { useMemo, useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/transactions")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" && localStorage.getItem("ph-admin-token");
    if (!token) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  head: () => ({ meta: [{ title: "Transactions — Admin" }] }),
  component: TxnPage,
});

function TxnPage() {
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    getPurchases().then((data) => {
      setAll(data);
      setLoading(false);
    });
  }, []);

  // Sort transactions by Newest First (most recent purchase at the top)
  const sortedTransactions = useMemo(() => {
    return [...all].sort((a, b) => {
      const dateA = new Date(a.date + (a.time ? "T" + a.time : "")).getTime();
      const dateB = new Date(b.date + (b.time ? "T" + b.time : "")).getTime();
      return dateB - dateA;
    });
  }, [all]);

  const list = sortedTransactions.filter((p) => {
    // Only display Payment Status = PAID / completed
    const isPaid = p.status === "paid" || p.status === "completed";
    if (!isPaid) return false;

    const matchQ =
      !q ||
      (p.buyer || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.college || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.transactionId || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.razorpayPaymentId || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.razorpayOrderId || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.email || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.mobile || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.domainName || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.projectTitle || "").toLowerCase().includes(q.toLowerCase());
    return matchQ;
  });

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 whenever search changes
  const handleSearch = (val: string) => { setQ(val); setPage(1); };

  return (
    <AdminShell title="Transactions">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          All PAID purchases across your domain bundles.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center h-11 bg-card ring-1 ring-border rounded-md px-4 flex-1 max-w-md focus-within:ring-primary">
          <Search className="size-4 text-muted-foreground mr-3" />
          <input
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search buyer, mobile, college, domain, project, payment ID..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      <div className="border border-border bg-card rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-6 py-3 font-medium">Buyer</th>
              <th className="text-left px-6 py-3 font-medium">College</th>
              <th className="text-left px-6 py-3 font-medium">Domain</th>
              <th className="text-left px-6 py-3 font-medium">Project</th>
              <th className="text-left px-6 py-3 font-medium">Amount</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-left px-6 py-3 font-medium">Date</th>
              <th className="text-left px-6 py-3 font-medium">Coupon Issued</th>
              <th className="text-left px-6 py-3 font-medium">Coupon Status</th>
              <th className="text-left px-6 py-3 font-medium">Book Offer Status</th>
              <th className="text-left px-6 py-3 font-medium">Order ID</th>
              <th className="text-left px-6 py-3 font-medium">Payment ID</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-6 py-4">
                  <div className="font-medium">{p.buyer}</div>
                  {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                  <div className="text-xs text-muted-foreground">{p.mobile}</div>
                </td>
                <td className="px-6 py-4">{p.college}</td>
                <td className="px-6 py-4">{p.domainName}</td>
                <td className="px-6 py-4">{p.projectTitle || "—"}</td>
                <td className="px-6 py-4 font-medium">₹{p.amount.toLocaleString("en-IN")}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-sm font-mono text-[10px] uppercase tracking-widest ${
                      p.status === "paid"
                        ? "bg-primary/15 text-primary"
                        : p.status === "pending"
                          ? "bg-accent text-accent-foreground"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-mono text-xs">{p.date}</div>
                  {p.time && <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{p.time}</div>}
                </td>
                <td className="px-6 py-4 font-mono text-xs">
                  {p.couponCode ? (
                    <span className="bg-secondary px-2 py-1 rounded text-foreground font-bold">{p.couponCode}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {p.couponCode ? (
                    <span className="px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400 font-semibold">
                      Active
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {p.bookUnlocked || p.bookOfferUnlocked ? (
                    <span className="px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400 font-semibold">
                      Unlocked
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider bg-muted text-muted-foreground">
                      —
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-mono text-xs select-all">{p.razorpayOrderId || "—"}</td>
                <td className="px-6 py-4 font-mono text-xs select-all">{p.razorpayPaymentId || "—"}</td>
              </tr>
            ))}
            {all.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-12 text-muted-foreground font-mono">
                  No Transactions Yet
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-12 text-muted-foreground">
                  No transactions match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-4 px-1">
        <p className="text-xs text-muted-foreground font-mono">
          Showing <span className="text-foreground font-semibold">{list.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}</span>–<span className="text-foreground font-semibold">{Math.min(safePage * PAGE_SIZE, list.length)}</span> of <span className="text-foreground font-semibold">{list.length}</span> transactions
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-mono font-semibold uppercase tracking-wider hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-3.5" /> Previous
          </button>
          <span className="font-mono text-xs px-3 py-2 rounded-md bg-card border border-border text-foreground">
            Page {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-mono font-semibold uppercase tracking-wider hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

    </AdminShell>
  );
}
