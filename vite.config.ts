import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // En GitHub Pages la app vive bajo /Bordes/; en desarrollo, en la raíz.
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Bordes",
        short_name: "Bordes",
        description: "Registro de sesiones de punto de cruz: proyectos, puntadas e hilos",
        theme_color: "#6d3b5b",
        background_color: "#f6f1ee",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});
