import axios from "axios";

const getBaseURL = () => {
  if (typeof window !== "undefined") {
    // Client-side: use VITE_API_URL if set, or empty to let browser resolve relative URLs
    return import.meta.env.VITE_API_URL || "";
  }
  // Server-side (SSR): resolve to Vercel domain or localhost backend
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:5000";
};

const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      let token = null;
      const isApiAdmin = config.url && (config.url.startsWith("/api/admin") || config.url.includes("/admin/"));
      if (isApiAdmin) {
        token = localStorage.getItem("ph-admin-token") || localStorage.getItem("ph-user-token");
      } else {
        token = localStorage.getItem("ph-user-token") || localStorage.getItem("ph-admin-token");
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401s (token expired/invalid)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear sessions if unauthorized
      if (typeof window !== "undefined") {
        localStorage.removeItem("ph-admin-token");
        localStorage.removeItem("ph-admin-session");
        localStorage.removeItem("ph-user-token");
      }
    }
    return Promise.reject(error);
  }
);

export default API;
