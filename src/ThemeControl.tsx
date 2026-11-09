import { useEffect, useState } from "react";
import IconTooltip from "./IconTooltip";
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
    <IconTooltip text={`Theme · ${value[0].toUpperCase() + value.slice(1)}`}>
    <div className="theme-control">
      <span className="utility-theme-label">Theme</span>
      <Dropdown
        label="Theme"
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
    </IconTooltip>
  );
}
