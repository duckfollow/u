import { useEffect, useState } from "react";
import Dropdown from "./Dropdown";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "./theme";
export default function ThemeControl() {
  const [value, setValue] = useState(getThemePreference);
  useEffect(() => {
    const sync = () => setValue(getThemePreference());
    window.addEventListener("u-theme-changed", sync);
    return () => window.removeEventListener("u-theme-changed", sync);
  }, []);
  return (
    <div className="theme-control">
      <span className="theme-control-label">Theme</span>
      <Dropdown
        label="Appearance"
        variant="theme"
        value={value}
        onChange={(value) => setThemePreference(value as ThemePreference)}
        options={[
          { value: "light", label: "Light", description: "A bright workspace" },
          {
            value: "dark",
            label: "Dark",
            description: "A softer workspace for low light",
          },
          {
            value: "system",
            label: "System",
            description: "Follow your device appearance",
          },
        ]}
      />
    </div>
  );
}
