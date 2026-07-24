import API from "../services/api";

export type Domain = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  thumbnail?: string;
  count: number;
  slug: string;
};

export type Project = {
  id: string;
  domainId: string;
  domainName: string;
  projectName: string;
  title?: string;
  description: string;
  longDescription: string;
  technologies: string[];
  difficulty: string;
  difficultyLevel?: string;
  price: number;
  thumbnailUrl: string;
  thumbnail?: string;
  resourcesIncluded: string[];
  files: { name: string; type: string; size: string }[];
  filesList: { id: string; name: string; filename: string; size: string; type: string; fileUrl: string }[];
  totalSize: string;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
};

export let DOMAINS: Domain[] = [];

export const CATEGORIES = [
  "All",
  "Engineering & Technology",
  "Commerce & Business Management",
  "Medicine & Healthcare Sciences",
  "Arts, Humanities & Social Sciences",
  "Pure & Applied Sciences",
  "Law & Legal Studies",
  "Architecture, Design & Fine Arts",
  "Agricultural & Environmental Sciences",
  "Hospitality, Tourism & Culinary Arts",
  "Media, Journalism & Communications"
];

export type Purchase = {
  id: string;
  domainId: string;
  domainName: string;
  projectId?: string;
  projectTitle?: string;
  buyer: string;
  mobile: string;
  college: string;
  email?: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  date: string;
  transactionId: string;
  bookUnlocked?: boolean;
  bookOfferUnlocked?: boolean;
  couponCode?: string;
  publisherName?: string;
  publisherWebsite?: string;
  publisherLink?: string;
  publisherLogo?: string;
  purchaseDate?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
};

// Format bytes to human readable format matching specified examples
export const formatBytes = (bytes: number) => {
  if (bytes <= 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  const decimals = i >= 3 ? 2 : (val % 1 === 0 ? 0 : 1);
  return parseFloat(val.toFixed(decimals)) + " " + sizes[i];
};

function mapBackendDomainToDomain(d: any): Domain {
  return {
    id: d.id,
    name: d.name || "Unnamed Domain",
    description: d.description || "",
    thumbnailUrl: d.thumbnailUrl || d.thumbnail || "",
    thumbnail: d.thumbnailUrl || d.thumbnail || "",
    count: d.count || 0,
    slug: d.id,
  };
}

export function mapBackendProjectToProject(p: any): Project {
  return {
    id: p.id,
    domainId: p.domainId || "",
    domainName: p.domainName || "",
    projectName: p.projectName || p.title || "Untitled Project",
    title: p.projectName || p.title || "Untitled Project",
    description: p.description || "",
    longDescription: p.longDescription || p.description || "",
    technologies: p.technologies || [],
    difficulty: p.difficulty || p.difficultyLevel || "Medium",
    difficultyLevel: p.difficulty || p.difficultyLevel || "Medium",
    price: p.price || 0,
    thumbnailUrl: p.thumbnailUrl || p.thumbnail || "",
    thumbnail: p.thumbnailUrl || p.thumbnail || "",
    resourcesIncluded: p.resourcesIncluded || [],
    files: p.files || [],
    filesList: p.filesList || [],
    totalSize: p.totalSize || "0 MB",
    downloads: p.downloads || 0,
    rating: p.rating || 5.0,
    createdAt: p.createdAt || "",
    updatedAt: p.updatedAt || "",
  };
}

// Async function to load domains from backend and update DOMAINS array
export async function fetchDomains() {
  try {
    const res = await API.get("/api/domains");
    if (res.data && Array.isArray(res.data)) {
      const mapped = res.data.map(mapBackendDomainToDomain);
      DOMAINS.length = 0;
      DOMAINS.push(...mapped);
    }
  } catch (err) {
    console.error("Failed to fetch domains from backend:", err);
  }
  return DOMAINS;
}

export async function getDomainBySlug(slug: string) {
  try {
    const res = await API.get(`/api/domains/${slug}`);
    if (res.data) {
      return mapBackendDomainToDomain(res.data);
    }
  } catch (err) {
    console.error(`Failed to fetch domain by slug (${slug}):`, err);
  }
  return DOMAINS.find((d) => d.slug === slug || d.id === slug);
}

export async function getDomainById(id: string) {
  return getDomainBySlug(id);
}

export async function fetchProjectsForDomain(domainId: string): Promise<Project[]> {
  try {
    const res = await API.get(`/api/domains/${domainId}/projects`);
    if (res.data && Array.isArray(res.data)) {
      return res.data.map(mapBackendProjectToProject);
    }
  } catch (err) {
    console.error(`Failed to fetch projects for domain (${domainId}):`, err);
  }
  return [];
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const res = await API.get(`/api/projects/${projectId}`);
    if (res.data) {
      return mapBackendProjectToProject(res.data);
    }
  } catch (err) {
    console.error(`Failed to fetch project details (${projectId}):`, err);
  }
  return null;
}

export async function fetchProjects(q: string = ""): Promise<Project[]> {
  try {
    const res = await API.get("/api/projects", { params: { q } });
    if (res.data && Array.isArray(res.data)) {
      return res.data.map(mapBackendProjectToProject);
    }
  } catch (err) {
    console.error("Failed to fetch projects:", err);
  }
  return [];
}

export async function getPurchases(): Promise<Purchase[]> {
  try {
    const isAdmin = typeof window !== "undefined" && !!localStorage.getItem("ph-admin-token");
    const endpoint = isAdmin ? "/api/admin/transactions" : "/api/purchases";
    const res = await API.get(endpoint);
    
    if (res.data && Array.isArray(res.data)) {
      return res.data.map((item: any) => {
        if (isAdmin) {
          return {
            id: item.orderId || item.id,
            domainId: item.projectId || "",
            domainName: item.domainName || "—",
            projectId: item.projectId,
            projectTitle: item.projectTitle || "—",
            buyer: item.user,
            mobile: item.mobile || "—",
            college: item.college || "—",
            email: item.email || undefined,
            amount: item.amount,
            status: item.status === "completed" ? "paid" : item.status,
            date: item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            transactionId: item.transactionId || item.id,
            couponCode: item.couponCode || "",
            bookUnlocked: item.bookUnlocked !== undefined ? item.bookUnlocked : (item.bookOfferUnlocked || false),
            bookOfferUnlocked: item.bookOfferUnlocked || false,
            publisherName: item.publisherName || "",
            publisherWebsite: item.publisherWebsite || item.publisherLink || "",
            publisherLink: item.publisherLink || "",
            publisherLogo: item.publisherLogo || "",
            purchaseDate: item.purchaseDate || "",
            time: item.time || "",
            razorpayOrderId: item.razorpayOrderId || "",
            razorpayPaymentId: item.razorpayPaymentId || ""
          };
        } else {
          const projectMapped = item.project ? mapBackendProjectToProject(item.project) : null;
          return {
            id: item.id,
            domainId: projectMapped?.domainId || "",
            domainName: projectMapped?.domainName || "—",
            projectId: item.project?.id || "",
            projectTitle: projectMapped?.projectName || "—",
            buyer: "Me",
            mobile: "—",
            college: "—",
            email: undefined,
            amount: item.amount,
            status: item.status === "completed" ? "paid" : item.status,
            date: item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            transactionId: item.razorpay_payment_id || item.id,
            couponCode: item.couponCode || "",
            bookUnlocked: item.bookUnlocked !== undefined ? item.bookUnlocked : (item.bookOfferUnlocked || false),
            bookOfferUnlocked: item.bookOfferUnlocked || false,
            publisherName: item.publisherName || "",
            publisherWebsite: item.publisherWebsite || item.publisherLink || "",
            publisherLink: item.publisherLink || "",
            publisherLogo: item.publisherLogo || "",
            purchaseDate: item.purchaseDate || "",
            razorpayOrderId: item.razorpayOrderId || item.razorpay_order_id || "",
            razorpayPaymentId: item.razorpayPaymentId || item.razorpay_payment_id || ""
          };
        }
      });
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch purchases:", err);
    return [];
  }
}

export function addPurchase(p: Purchase) {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem("ph-purchases");
  const extra: Purchase[] = stored ? JSON.parse(stored) : [];
  localStorage.setItem("ph-purchases", JSON.stringify([p, ...extra]));
}

/* Admin authentication */
export async function adminLogin(email: string, password: string): Promise<boolean> {
  try {
    let res;
    try {
      res = await API.post("/api/auth/login", { email, password });
    } catch (e) {
      res = await API.post("/api/admin/login", { email, password });
    }
    if (res.data && res.data.access_token) {
      localStorage.setItem("ph-admin-token", res.data.access_token);
      localStorage.setItem(
        "ph-admin-session",
        JSON.stringify({ email: res.data.user.email, name: res.data.user.name })
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error("Admin login API error:", err);
    return false;
  }
}

export async function adminRegister(name: string, email: string, password: string): Promise<boolean> {
  try {
    let res;
    try {
      res = await API.post("/api/auth/register", { name, email, password });
    } catch (e) {
      res = await API.post("/api/admin/register", { name, email, password });
    }
    if (res.data && res.data.access_token) {
      localStorage.setItem("ph-admin-token", res.data.access_token);
      localStorage.setItem(
        "ph-admin-session",
        JSON.stringify({ email: res.data.user.email, name: res.data.user.name })
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error("Admin register API error:", err);
    return false;
  }
}

export function adminLogout() {
  localStorage.removeItem("ph-admin-token");
  localStorage.removeItem("ph-admin-session");
}

export function getAdminSession(): { email: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem("ph-admin-session");
  return s ? JSON.parse(s) : null;
}
