import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useEffect, useState } from "react";
import { getAdminSession } from "@/lib/data";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, Monitor } from "lucide-react";
import API from "@/services/api";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" && localStorage.getItem("ph-admin-token");
    if (!token) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [session, setSession] = useState<{ email: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [siteName, setSiteName] = useState("ProjectHub");
  const [tagline, setTagline] = useState("Premium Academic Resources");
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Change Password States
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  // Book Promotion States
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [publisherName, setPublisherName] = useState("");
  const [publisherUrl, setPublisherUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [popupImage, setPopupImage] = useState("");
  const [publisherLogo, setPublisherLogo] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [validTill, setValidTill] = useState("");
  const [promoSaved, setPromoSaved] = useState(false);
  const [promoError, setPromoError] = useState("");


  useEffect(() => {
    const s = getAdminSession();
    if (s) {
      setSession(s);
      setName(s.name);
    }

    // Fetch existing promo settings
    API.get("/api/book-promotion")
      .then((res) => {
        const d = res.data;
        if (d) {
          setPromoEnabled(d.isEnabled ?? false);
          setPromoTitle(d.title ?? "");
          setPromoDesc(d.description ?? "");
          setPublisherName(d.publisherName ?? "");
          setPublisherUrl(d.publisherWebsite ?? "");
          setCouponCode(d.couponCode ?? "");
          setPopupImage(d.popupImage ?? "");
          setPublisherLogo(d.publisherLogo ?? "");
          setBannerImage(d.bannerImage ?? "");
          setValidTill(d.validTill ?? "");
        }
      })
      .catch((err) => console.error("Error fetching promo settings:", err));
  }, []);

  const handleSavePromo = async () => {
    setPromoSaved(false);
    setPromoError("");
    try {
      await API.put("/api/admin/book-promotion", {
        isEnabled: promoEnabled,
        title: promoTitle,
        description: promoDesc,
        publisherName: publisherName,
        publisherWebsite: publisherUrl,
        couponCode: couponCode,
        popupImage: popupImage,
        publisherLogo: publisherLogo,
        bannerImage: bannerImage,
        validTill: validTill
      });
      setPromoSaved(true);
      setTimeout(() => setPromoSaved(false), 2000);
    } catch (err: any) {
      setPromoError(err.response?.data?.error || "Failed to update settings");
    }
  };

  const handleSaveProfile = async () => {
    setSaved(false);
    setProfileError("");
    try {
      await API.patch("/api/auth/me", { name });
      // Update session locally
      const stored = localStorage.getItem("ph-admin-session");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("ph-admin-session", JSON.stringify({ ...parsed, name }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setProfileError(err.response?.data?.error || "Failed to save profile");
    }
  };

  const handleChangePassword = async () => {
    setPwSaved(false);
    setPwError("");
    if (!oldPassword || !newPassword) {
      setPwError("Both current and new password are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    try {
      await API.patch("/api/auth/me", { old_password: oldPassword, new_password: newPassword });
      setPwSaved(true);
      setOldPassword("");
      setNewPassword("");
      setTimeout(() => setPwSaved(false), 2500);
    } catch (err: any) {
      setPwError(err.response?.data?.error || "Failed to change password");
    }
  };

  if (!session) return null;

  return (
    <AdminShell title="Settings">
      <div className="mb-8">
        <h1 className="font-serif text-3xl mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, theme and website preferences.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Section title="Profile" desc="Information used across the admin console.">
          <Field label="Full Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label="Email">
            <input
              value={session.email}
              disabled
              className="w-full h-11 px-3 rounded-md border border-input bg-muted text-muted-foreground"
            />
          </Field>
        </Section>

        <Section title="Theme Preference" desc="Choose how the admin console appears.">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { v: "light", label: "Light", icon: Sun },
                { v: "dark", label: "Dark", icon: Moon },
                { v: "system", label: "System", icon: Monitor },
              ] as const
            ).map(({ v, label, icon: I }) => (
              <button
                key={v}
                onClick={() => setTheme(v)}
                className={`flex flex-col items-start gap-2 p-4 rounded-md border-2 transition-colors ${
                  theme === v ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"
                }`}
              >
                <I className="size-4 text-primary" />
                <div className="text-sm font-medium">{label}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Change Password" desc="Update your admin password.">
          <Field label="Current Password">
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="Enter current password"
            />
          </Field>
          <Field label="New Password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="Min. 6 characters"
            />
          </Field>
          <div className="flex items-center justify-end gap-3 pt-1">
            {pwError && (
              <span className="text-xs text-destructive font-mono">{pwError}</span>
            )}
            {pwSaved && (
              <span className="text-xs text-primary font-mono uppercase tracking-widest">✓ Password Updated</span>
            )}
            <button
              onClick={handleChangePassword}
              className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90"
            >
              Update Password
            </button>
          </div>
        </Section>


        <Section title="Book Promotion Settings" desc="Configure the Free Physical Book Reward promotion.">
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={promoEnabled}
              onChange={(e) => setPromoEnabled(e.target.checked)}
              className="size-4 rounded border border-input text-primary focus:ring-ring"
            />
            <span className="text-sm font-medium">Promotion Enabled</span>
          </label>

          <Field label="Popup Title">
            <input
              value={promoTitle}
              onChange={(e) => setPromoTitle(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="e.g. 🎁 Exclusive Student Reward"
            />
          </Field>

          <Field label="Popup Description">
            <textarea
              value={promoDesc}
              onChange={(e) => setPromoDesc(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 text-sm"
              placeholder="Enter popup description..."
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Popup Image URL">
              <input
                value={popupImage}
                onChange={(e) => setPopupImage(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder="Leave empty or enter absolute path/URL to popup image"
              />
            </Field>

            <Field label="Publisher Logo URL">
              <input
                value={publisherLogo}
                onChange={(e) => setPublisherLogo(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder="Leave empty or enter absolute path/URL to publisher logo image"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Publisher Name">
              <input
                value={publisherName}
                onChange={(e) => setPublisherName(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder="e.g. Official Publishing Partner"
              />
            </Field>

            <Field label="Publisher Website URL">
              <input
                value={publisherUrl}
                onChange={(e) => setPublisherUrl(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder="e.g. https://example.com/books"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Coupon Code">
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder="e.g. FREEBOOKSTUDENT"
              />
            </Field>

            <Field label="Offer Valid Until">
              <input
                type="date"
                value={validTill}
                onChange={(e) => setValidTill(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
          </div>

          <Field label="Banner Image URL">
            <input
              value={bannerImage}
              onChange={(e) => setBannerImage(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="Leave empty or enter absolute path/URL to promotional banner image"
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
            {promoError && (
              <span className="text-sm text-destructive font-mono text-[10px]">
                {promoError}
              </span>
            )}
            {promoSaved && (
              <span className="text-sm text-primary font-mono uppercase tracking-widest text-[10px]">
                ✓ Settings Saved
              </span>
            )}
            <button
              onClick={handleSavePromo}
              className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md"
            >
              Save Book Promotion Settings
            </button>
          </div>
        </Section>

        <div className="flex items-center justify-end gap-3 pt-4">
          {profileError && (
            <span className="text-xs text-destructive font-mono">{profileError}</span>
          )}
          {saved && (
            <span className="text-sm text-primary font-mono uppercase tracking-widest text-[10px]">
              ✓ Profile Saved
            </span>
          )}
          <button
            onClick={handleSaveProfile}
            className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card rounded-md p-6">
      <div className="mb-5">
        <div className="font-serif text-xl">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
