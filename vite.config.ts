import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Tauri expects a fixed port and fails if it is not available.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // src-tauri is watched by the Rust toolchain, not Vite.
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Tauri uses a modern WebView (WebView2 on Windows), so we can target recent JS.
    target: "chrome110",
    sourcemap: false,
  },
}));
