import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css"; // self-hosted, so the demo works offline
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./tabs.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
