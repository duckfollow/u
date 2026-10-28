import { isDesktop } from "./native";
export type ThemePreference = "light" | "dark" | "system";
const key = "u-theme";
function read(): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    if (value === "light" || value === "dark") return value;
  } catch {}
  return "system";
}
let preference = read();
export const getThemePreference = () => preference;
function apply() {
  const resolved =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#141622" : "#f7f8fb");
  if (isDesktop())
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) =>
        getCurrentWindow().setTheme(
          preference === "system" ? null : preference,
        ),
      )
      .catch(() => {});
  window.dispatchEvent(new Event("u-theme-changed"));
}
export function setThemePreference(value: ThemePreference) {
  preference = value;
  try {
    localStorage.setItem(key, value);
  } catch {}
  apply();
}
export function initializeTheme() {
  apply();
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (preference === "system") apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      preference = read();
      apply();
    }
  });
}
