/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Strip the `crossorigin` attribute Vite puts on the bundled module scripts /
// modulepreload links. On Tauri's custom protocol (tauri://) the assets are
// same-origin, but `crossorigin` forces a CORS check the protocol doesn't
// satisfy — which makes WebKitGTK MASK every uncaught error as
// "Script error. (?:0:0)" (no file/line). Removing it lets the real messages +
// stacks through, so the Nova Linux logs are actually useful.
function stripCrossorigin() {
  return {
    name: 'nova-strip-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin(="[^"]*")?/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), stripCrossorigin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
});
