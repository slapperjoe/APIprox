import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: './',
    clearScreen: false,
    server: {
        port: 5174,
        strictPort: true,
        fs: {
            // Allow serving files from outside the project root.
            // Needed for the symlinked @apinox/request-editor package (Monaco editor).
            // Safe here because Vite only runs locally for desktop app development.
            strict: false,
        },
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        outDir: 'dist',
        target: 'es2020',
        minify: true
    }
})
