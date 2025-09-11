export default {
  url: import.meta.env.VITE_BACKEND_URL,
  demo: import.meta.env.VITE_DEMO === "true",
  appName: import.meta.env.VITE_SITE_TITLE || "LTC Flow",
  brand: import.meta.env.VITE_SITE_BRAND || "LTC Flow",
  showCredits: import.meta.env.VITE_SHOW_CREDITS === "true",
  billing: {
    baseUserLimit: parseInt(import.meta.env.VITE_BASE_USER_LIMIT) || 20,
    perUserRate: parseFloat(import.meta.env.VITE_PER_USER_RATE) || 5.0,
    currency: import.meta.env.VITE_BILLING_CURRENCY || "USD",
  },
  // 🆕 NEW: Subdomain configuration
  subdomain: {
    domain: import.meta.env.VITE_DOMAIN || "ltcflow.com",
    protocol: import.meta.env.VITE_PROTOCOL || "https",
    port: import.meta.env.VITE_PORT || "",
  },
};
