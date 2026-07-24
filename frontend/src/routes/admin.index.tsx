import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useState, useEffect } from "react";
import { Folder, FileText, Download, ArrowUpRight, Receipt, Loader2 } from "lucide-react";
import API from "@/services/api";
import { motion } from "framer-motion";
import { getAdminSession } from "@/lib/data";

export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" && localStorage.getItem("ph-admin-token");
    if (!token) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  head: () => ({ meta: [{ title: "Admin Dashboard — ProjectHub" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/api/admin/analytics")
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <AdminShell title="Dashboard">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  const totalDomains = data?.totalDomains || 0;
  const totalProjects = data?.totalProjects || 0;
  const totalFiles = data?.totalFiles || 0;
  const totalOrders = data?.totalOrders || 0;
  const totalDownloads = data?.totalDownloads || 0;

  const adminName = getAdminSession()?.name || "Admin";

  const stats = [
    { label: "Total Domains", value: totalDomains, icon: Folder },
    { label: "Total Projects", value: totalProjects, icon: FileText },
    { label: "Total Sales", value: totalOrders, icon: Receipt },
    { label: "Total Downloads", value: totalDownloads, icon: Download },
  ];

  const purchases = data?.recentOrders || [];

  return (
    <AdminShell title="Dashboard">
      <div className="mb-8">
        <h1 className="font-serif text-3xl mb-1">Hi, {adminName} <span className="italic">👋</span></h1>
        <p className="text-muted-foreground">Here's what's happening with your archive today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="border border-border bg-card rounded-md p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="size-9 rounded-md bg-primary/10 grid place-items-center text-primary">
                <s.icon className="size-4" />
              </div>
            </div>
            <div className="text-2xl font-medium font-serif">{s.value}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>

      {totalProjects === 0 && totalOrders === 0 ? (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground bg-card mb-8">
          <p className="text-lg font-medium text-foreground">No Analytics Available Yet</p>
          <p className="text-sm mt-1">Create domains and complete checkouts to see dashboard activity.</p>
        </div>
      ) : (
        <div className="border border-border bg-card rounded-md">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Activity
              </div>
              <div className="font-serif text-xl">Recent transactions</div>
            </div>
            <Link
              to="/admin/transactions"
              className="text-xs font-mono uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {purchases.slice(0, 5).map((p: any) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between text-sm">
                <div className="min-w-0 mr-4">
                  <div className="font-medium truncate">{p.user}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.projectTitle}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">₹{p.amount.toLocaleString("en-IN")}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {p.date ? p.date.slice(0, 10) : ""}
                  </div>
                </div>
              </div>
            ))}
            {purchases.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No recent transactions.
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
