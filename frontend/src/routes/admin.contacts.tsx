import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useState, useEffect } from "react";
import { Search, CheckCircle, Clock, Trash2, MessageSquare, Loader2 } from "lucide-react";
import API from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/contacts")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [{ title: "Contact Requests — Admin" }] }),
  component: () => null,
});

function AdminContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await API.get("/api/admin/contacts");
      setContacts(res.data || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      toast.error("Failed to fetch contact requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleToggleStatus = async (id: string) => {
    setUpdatingId(id);
    try {
      const res = await API.post(`/api/admin/contacts/${id}/toggle-status`);
      toast.success(res.data.message || "Status updated successfully");
      await fetchContacts();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to toggle status: " + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = contacts.filter((c) => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchQ =
      !q ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.email.toLowerCase().includes(q.toLowerCase()) ||
      c.mobile.includes(q) ||
      c.message.toLowerCase().includes(q.toLowerCase());
    return matchStatus && matchQ;
  });

  return (
    <AdminShell title="Contact Requests">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Contact Requests</h1>
        <p className="text-muted-foreground text-sm">
          View and manage support inquiries submitted by users.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center h-11 bg-card ring-1 ring-border rounded-md px-4 flex-1 max-w-md focus-within:ring-primary">
          <Search className="size-4 text-muted-foreground mr-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search inquiries by keyword..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-mono uppercase tracking-widest rounded-sm border ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="border border-border bg-card rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-6 py-3 font-medium">Sender</th>
                <th className="text-left px-6 py-3 font-medium">Message</th>
                <th className="text-left px-6 py-3 font-medium">Date</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-right px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30 items-start">
                  <td className="px-6 py-4 max-w-[200px] align-top">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    <div className="text-xs text-muted-foreground">{c.mobile}</div>
                  </td>
                  <td className="px-6 py-4 align-top whitespace-pre-line max-w-[400px]">
                    <p className="text-xs text-foreground/90">{c.message}</p>
                  </td>
                  <td className="px-6 py-4 align-top font-mono text-xs">
                    {c.date ? c.date.slice(0, 10) : ""}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {c.date ? c.date.slice(11, 19) : ""}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span
                      className={`px-2 py-1 rounded-sm font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 ${
                        c.status === "resolved"
                          ? "bg-primary/15 text-primary"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {c.status === "resolved" ? (
                        <CheckCircle className="size-3" />
                      ) : (
                        <Clock className="size-3" />
                      )}
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-right shrink-0">
                    <button
                      onClick={() => handleToggleStatus(c.id)}
                      disabled={updatingId === c.id}
                      className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-widest border transition-colors inline-flex items-center gap-1.5 ${
                        c.status === "resolved"
                          ? "border-border text-muted-foreground hover:bg-accent"
                          : "border-primary text-primary hover:bg-primary/5"
                      }`}
                    >
                      {updatingId === c.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {c.status === "resolved" ? "Mark Pending" : "Mark Resolved"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No contact requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
