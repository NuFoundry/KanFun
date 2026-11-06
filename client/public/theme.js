// Apply the saved theme before first paint to avoid a flash. Loaded by index.html as a file so the
// Content-Security-Policy can stay `script-src 'self'` (no inline scripts).
try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
    // The dark theme's --background (client/src/styles.css), as hooks/use-theme.ts sets it.
    document.querySelector('meta[name="theme-color"]').content = "#0b0a09";
  }
} catch {
  // storage blocked: keep the light theme
}
