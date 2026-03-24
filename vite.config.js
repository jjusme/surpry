import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['surpry.png', 'icon.svg'],
      manifest: {
        name: 'Surpry',
        short_name: 'Surpry',
        description: 'Organiza Regalos Sorpresa en Grupo',
        theme_color: '#0df2f2',
        background_color: '#0b1218',
        display: 'standalone',
        icons: [
          {
            src: 'surpry.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});
