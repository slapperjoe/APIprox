import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: './',
    clearScreen: false,
    server: {
        port: 5174,
        strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        outDir: 'dist',
        target: 'es2020',
        minify: true
    }
})
