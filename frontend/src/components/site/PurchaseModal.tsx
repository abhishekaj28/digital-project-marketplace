import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { addPurchase } from "@/lib/data";
import API from "../../services/api";

// ─── Debug logger ────────────────────────────────────────────────────────────
const log = (step: string, data?: any) => {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[PaymentPipeline][${ts}] ${step}`, data);
  } else {
    console.log(`[PaymentPipeline][${ts}] ${step}`);
  }
};
const logError = (step: string, err: any) => {
  const ts = new Date().toISOString();
  console.error(`[PaymentPipeline][${ts}] ❌ ${step}`, err);
};

// ─── Razorpay SDK Loader ──────────────────────────────────────────────────────
function loadRazorpaySDK(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      log("Step 5: Razorpay SDK already loaded — window.Razorpay exists");
      resolve(true);
      return;
    }
    log("Step 5: Loading Razorpay SDK dynamically from checkout.razorpay.com");
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      log("Step 5: ✅ Razorpay SDK loaded successfully — window.Razorpay:", typeof (window as any).Razorpay);
      resolve(true);
    };
    script.onerror = (e) => {
      logError("Step 5: Razorpay SDK failed to load (network/CDN issue)", e);
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PurchaseModal({
  domain,
  open,
  onClose,
}: {
  domain: any;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", mobile: "", college: "", email: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [promoActive, setPromoActive] = useState(false);
  // Track whether Razorpay checkout is open so we don't reset loading prematurely
  const rzpOpenRef = useRef(false);

  const resolvedName = domain.projectName || domain.title || domain.name || "Resource Package";
  const resolvedPrice = domain.price;
  const resolvedSlug = domain.slug || domain.id;

  useEffect(() => {
    if (open) {
      log("Modal opened — checking book promotion status");
      API.get("/api/book-promotion")
        .then((res) => {
          if (res.data && res.data.isEnabled) {
            setPromoActive(true);
            log("Book promotion: ACTIVE");
          } else {
            setPromoActive(false);
            log("Book promotion: inactive");
          }
        })
        .catch((e) => {
          logError("Book promotion check failed (non-critical)", e);
          setPromoActive(false);
        });
    }
  }, [open]);

  const setError = (msg: string) => {
    setErr({ submit: msg });
    setLoading(false);
    setStatusMsg("");
    rzpOpenRef.current = false;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    log("Step 1: PAY & DOWNLOAD button clicked");

    // ── Validation ────────────────────────────────────────────────────────────
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Required";
    if (!/^\d{10}$/.test(form.mobile.trim())) errors.mobile = "10-digit mobile required";
    if (!form.college.trim()) errors.college = "Required";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Invalid email";
    setErr(errors);
    if (Object.keys(errors).length) {
      log("Step 2: Validation FAILED", errors);
      return;
    }
    log("Step 2: Validation PASSED", { name: form.name, mobile: form.mobile, college: form.college });

    setLoading(true);
    setStatusMsg("Loading payment gateway...");
    setErr({});

    try {
      // ── Step 5: Load Razorpay SDK ────────────────────────────────────────
      const scriptLoaded = await loadRazorpaySDK();
      if (!scriptLoaded) {
        setError("Razorpay SDK failed to load. Please check your internet connection and try again.");
        return;
      }

      // ── Step 3 & 4: Create order on backend ─────────────────────────────
      log("Step 3: Sending POST /api/payments/create-order", {
        projectId: domain.id,
        name: form.name,
        mobile: form.mobile,
        college: form.college,
        email: form.email || undefined,
      });
      setStatusMsg("Creating payment order...");

      let paymentOrderRes: any;
      try {
        paymentOrderRes = await API.post("/api/payments/create-order", {
          name: form.name,
          mobile: form.mobile,
          college: form.college,
          email: form.email || undefined,
          projectId: domain.id,
          domainId: domain.id,
        });
      } catch (apiErr: any) {
        const statusCode = apiErr?.response?.status;
        const errMsg = apiErr?.response?.data?.error || apiErr.message || "Network error";
        logError(`Step 3: POST /api/payments/create-order FAILED (HTTP ${statusCode})`, apiErr);
        if (!apiErr?.response) {
          setError("Unable to connect to backend server. Is the Flask server running on port 5000?");
        } else if (statusCode === 400) {
          setError(`Invalid request: ${errMsg}`);
        } else if (statusCode === 404) {
          setError(`Project not found: ${errMsg}`);
        } else if (statusCode === 502) {
          setError(`Unable to create Razorpay Order: ${errMsg}`);
        } else {
          setError(`Backend error (${statusCode}): ${errMsg}`);
        }
        return;
      }

      const {
        order_id,
        key_id,
        currency,
        amount,
        amount_paise,
        is_mock,
        access_token,
        already_owned,
      } = paymentOrderRes.data;

      log("Step 4: Received order response from backend", {
        order_id,
        amount,
        amount_paise,
        currency,
        key_id: key_id ? `${key_id.slice(0, 12)}...` : "(empty)",
        is_mock,
        already_owned,
        has_access_token: !!access_token,
      });

      // Handle already purchased
      if (already_owned) {
        log("Project already purchased — redirecting to payment-success");
        onClose();
        navigate({ to: "/payment-success", search: { txn: order_id, domain: resolvedSlug } });
        return;
      }

      // Store access token for subsequent API calls (verify, download)
      if (access_token) {
        log("Storing guest access_token in localStorage for subsequent API calls");
        localStorage.setItem("ph-user-token", access_token);
      }

      if (!order_id) {
        setError("Backend returned no order_id. Check Flask logs.");
        return;
      }

      // ── Step 6: Determine checkout flow ───────────────────────────────────
      if (is_mock) {
        log("Step 6: MOCK FLOW — Razorpay keys unavailable or test mode. Simulating payment.");
        setStatusMsg("Processing mock payment...");

        const mockTxnId = `pay_mock_${Math.floor(100000 + Math.random() * 900000)}`;
        log("Step 8 (mock): Calling POST /api/payments/verify with mock IDs", { order_id, mockTxnId });

        let mockVerifyRes: any;
        try {
          mockVerifyRes = await API.post("/api/payments/verify", {
            razorpay_order_id: order_id,
            razorpay_payment_id: mockTxnId,
            razorpay_signature: "mock_signature",
            name: form.name,
            mobile: form.mobile,
            college: form.college,
            email: form.email || undefined,
            projectId: domain.id,
            domainId: domain.id,
          });
        } catch (verifyErr: any) {
          const statusCode = verifyErr?.response?.status;
          const errMsg = verifyErr?.response?.data?.error || verifyErr.message;
          logError(`Step 8 (mock): Verify call FAILED (HTTP ${statusCode})`, verifyErr);
          if (statusCode === 401) {
            setError("Payment Verification Failed: Authentication error. The guest token may not have been stored correctly.");
          } else {
            setError(`Payment Verification Failed: ${errMsg || "Unknown error"}`);
          }
          return;
        }

        log("Step 9 (mock): Verify response", mockVerifyRes.data);

        if (mockVerifyRes.data.success) {
          log("Step 10 (mock): Payment verified — saving purchase and redirecting");
          addPurchase({
            id: order_id,
            domainId: domain.id,
            domainName: resolvedName,
            projectId: domain.id,
            projectTitle: resolvedName,
            buyer: form.name,
            mobile: form.mobile,
            college: form.college,
            email: form.email || undefined,
            amount: resolvedPrice,
            status: "paid",
            date: new Date().toISOString().slice(0, 10),
            transactionId: order_id,
          });
          setLoading(false);
          setStatusMsg("");
          onClose();
          navigate({ to: "/payment-success", search: { txn: order_id, domain: resolvedSlug } });
        } else {
          logError("Step 9 (mock): Verification returned success=false", mockVerifyRes.data);
          setLoading(false);
          setStatusMsg("");
          onClose();
          navigate({ to: "/payment-failed", search: { domain: resolvedSlug } });
        }
      } else {
        // ── Real Razorpay Checkout ──────────────────────────────────────────
        const frontendKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID || key_id || "").trim();
        if (!frontendKeyId) {
          setError("Razorpay Key ID is missing. Set VITE_RAZORPAY_KEY_ID in frontend .env and RAZORPAY_KEY_ID in backend .env");
          return;
        }

        // Amount must be in paise for Razorpay SDK
        // Backend returns amount_paise (paise) OR amount (INR)
        // Use amount_paise if provided; otherwise multiply amount by 100
        const amountInPaise = amount_paise ?? (amount * 100);

        log("Step 6: Opening Official Razorpay Checkout", {
          key: `${frontendKeyId.slice(0, 12)}...`,
          order_id,
          amount_paise: amountInPaise,
          currency,
        });
        setStatusMsg("Opening Razorpay Checkout...");

        const options = {
          key: frontendKeyId,
          amount: amountInPaise,
          currency: currency || "INR",
          name: "ProjectHub",
          description: resolvedName,
          order_id: order_id,
          handler: async (response: any) => {
            // This runs after successful payment — it's an async callback
            log("Step 8: Payment success callback received from Razorpay", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature ? "present" : "missing",
            });
            setStatusMsg("Verifying payment...");
            setLoading(true);

            try {
              log("Step 8: Calling POST /api/payments/verify");
              const verifyRes = await API.post("/api/payments/verify", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                name: form.name,
                mobile: form.mobile,
                college: form.college,
                email: form.email || undefined,
                projectId: domain.id,
                domainId: domain.id,
              });

              log("Step 9: Verify response", verifyRes.data);

              if (verifyRes.data.success) {
                log("Step 10: Payment verified — saving purchase locally");
                addPurchase({
                  id: response.razorpay_order_id,
                  domainId: domain.id,
                  domainName: resolvedName,
                  projectId: domain.id,
                  projectTitle: resolvedName,
                  buyer: form.name,
                  mobile: form.mobile,
                  college: form.college,
                  email: form.email || undefined,
                  amount: resolvedPrice,
                  status: "paid",
                  date: new Date().toISOString().slice(0, 10),
                  transactionId: response.razorpay_payment_id,
                });
                log("Step 11: Redirecting to Payment Success page");
                setLoading(false);
                setStatusMsg("");
                rzpOpenRef.current = false;
                onClose();
                navigate({
                  to: "/payment-success",
                  search: { txn: response.razorpay_payment_id, domain: resolvedSlug },
                });
              } else {
                logError("Step 9: Verify returned success=false", verifyRes.data);
                setLoading(false);
                setStatusMsg("");
                rzpOpenRef.current = false;
                onClose();
                navigate({ to: "/payment-failed", search: { domain: resolvedSlug } });
              }
            } catch (verifyErr: any) {
              const statusCode = verifyErr?.response?.status;
              const errMsg = verifyErr?.response?.data?.error || verifyErr.message;
              logError(`Step 9: Payment Verification API FAILED (HTTP ${statusCode})`, verifyErr);
              setLoading(false);
              setStatusMsg("");
              rzpOpenRef.current = false;
              // Show error in modal instead of navigating away
              setErr({
                submit:
                  statusCode === 401
                    ? "Payment Verification Failed: Session expired. Please refresh and try again."
                    : `Payment Verification Failed: ${errMsg || "Unknown error"}. Your payment may have been deducted — contact support with your payment ID: ${response.razorpay_payment_id}`,
              });
            }
          },
          modal: {
            ondismiss: () => {
              log("Razorpay modal dismissed by user");
              rzpOpenRef.current = false;
              setLoading(false);
              setStatusMsg("");
              onClose();
              navigate({ to: "/payment-cancelled", search: { domain: resolvedSlug } });
            },
            escape: true,
            backdropclose: false,
          },
          prefill: {
            name: form.name,
            email: form.email || "",
            contact: form.mobile,
          },
          notes: {
            project_id: domain.id,
            buyer_name: form.name,
            college: form.college,
          },
          theme: {
            color: "#3b82f6",
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          logError("Razorpay payment.failed event", response);
          rzpOpenRef.current = false;
          setLoading(false);
          setStatusMsg("");
          onClose();
          navigate({ to: "/payment-failed", search: { domain: resolvedSlug } });
        });

        log("Step 6: Calling rzp.open() — Official Razorpay Checkout should appear now");
        rzpOpenRef.current = true;
        // Keep loading = true while Razorpay is open
        // Don't run finally setLoading(false) while Razorpay overlay is active
        rzp.open();
        setStatusMsg("Complete payment in Razorpay...");
        // Return here — do NOT let finally run setLoading(false) while RZP is open
        return;
      }
    } catch (error: any) {
      logError("Unhandled error in payment submit", error);
      const errMsg =
        error?.response?.data?.error ||
        error?.message ||
        "An unexpected error occurred during checkout";
      setError(errMsg);
    } finally {
      // Only reset loading if Razorpay checkout is NOT currently open
      if (!rzpOpenRef.current) {
        setLoading(false);
        setStatusMsg("");
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm grid place-items-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
            className="w-full max-w-lg rounded-lg bg-card border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 pb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1 text-left">
                  Checkout
                </div>
                <h3 className="font-serif text-2xl text-left">Purchase {resolvedName}</h3>
                <p className="text-sm text-muted-foreground mt-1 text-left">
                  Enter your details to receive the download instantly.
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid size-8 place-items-center rounded-full hover:bg-accent text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={submit} className="px-6 pb-6 space-y-4">
              <Field label="Full Name *" error={err.name}>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mobile *" error={err.mobile}>
                  <input
                    inputMode="numeric"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </Field>
                <Field label="Email" error={err.email}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </Field>
              </div>
              <Field label="College Name *" error={err.college}>
                <input
                  value={form.college}
                  onChange={(e) => setForm({ ...form, college: e.target.value })}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </Field>

              <div className="bg-muted/40 border border-border rounded-md p-4 space-y-2.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-left">
                  Your Purchase Includes
                </div>
                <div className="space-y-1.5 text-xs text-foreground/90 text-left">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span className="text-primary font-bold">✓</span> Project ZIP Download
                  </div>
                  {promoActive && (
                    <div className="flex items-center gap-2 font-semibold text-foreground animate-pulse">
                      <span className="text-primary font-bold">✓</span> FREE Book Coupon
                    </div>
                  )}
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span className="text-primary font-bold">✓</span> Instant Access
                  </div>
                </div>
              </div>

              {/* ── Error Display ── */}
              {err.submit && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"
                >
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm text-destructive leading-snug">{err.submit}</div>
                </motion.div>
              )}

              {/* ── Status message while processing ── */}
              {loading && statusMsg && (
                <div className="text-xs font-mono text-muted-foreground text-center animate-pulse">
                  {statusMsg}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-left">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Total</div>
                  <div className="text-2xl font-medium">₹{resolvedPrice.toLocaleString("en-IN")}</div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? (statusMsg || "Processing...") : "Pay & Download"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
      {error && <div className="text-xs text-destructive mt-1">{error}</div>}
    </label>
  );
}
