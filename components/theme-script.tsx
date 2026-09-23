import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Runs before paint (rendered directly in <head>, no "use client" needed — it's just a plain
 * <script> tag) so the correct theme class is set immediately. Without this, the page would
 * always paint light first and then flash to dark a moment later for dark-mode users.
 */
export function ThemeScript() {
  const script = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var isDark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
