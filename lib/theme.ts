export const THEME_STORAGE_KEY = "organize:theme";
export type Theme = "light" | "dark" | "system";

/** Applies the resolved theme class to <html>. Safe to call from any client component. */
export function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}
