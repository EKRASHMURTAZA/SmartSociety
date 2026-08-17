export type ThemePreference = "light" | "dark" | "system";

const KEY = "ss-theme";

export function storedTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0b1220" : "#0d9488");
}

export function saveTheme(pref: ThemePreference) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
}

export function cycleTheme(current: ThemePreference): ThemePreference {
  const order: ThemePreference[] = ["light", "dark", "system"];
  return order[(order.indexOf(current) + 1) % order.length];
}