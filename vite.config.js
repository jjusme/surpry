import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['surpry-icon.png', 'surpry-logo-nobg.png'],
      manifest: {
        name: 'Surpry',
        short_name: 'Surpry',
        description: 'Organiza Regalos Sorpresa en Grupo',
        theme_color: '#8B5CF6',
        background_color: '#FAFAFE',
        display: 'standalone',
        icons: [
          {
            src: 'surpry-icon.png',
            sizes: '500x500',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});
