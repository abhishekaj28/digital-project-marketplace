import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/dashboard")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" && localStorage.getItem("ph-admin-token");
    if (!token) {
      throw redirect({ to: "/unauthorized" });
    }
    throw redirect({ to: "/admin" });
  },
  component: () => null,
});
