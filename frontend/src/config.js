export default {
  url: import.meta.env.VITE_BACKEND_URL,
  demo: import.meta.env.VITE_DEMO === "true",
  appName: import.meta.env.VITE_SITE_TITLE || "LTC Flow",
  brand: import.meta.env.VITE_SITE_BRAND || "LTC Flow",
  showCredits: import.meta.env.VITE_SHOW_CREDITS === "true",
};
