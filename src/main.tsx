import { initializeTheme } from "./theme";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";

initializeTheme();

createRoot(document.getElementById("root")!).render(<App />);
