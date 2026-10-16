// Vite builds the dashboard into frontend/dist, which the FastAPI server serves.
// During development (`npm run dev`), /api calls are forwarded to the Python server
// started with `python run_demo.py --no-browser`.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
