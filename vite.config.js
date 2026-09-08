import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        storage: resolve(root, 'services/hangar-storage.html'),
        line: resolve(root, 'services/line-maintenance.html'),
        base: resolve(root, 'services/base-maintenance.html'),
        network: resolve(root, 'network.html'),
        sustainability: resolve(root, 'sustainability.html'),
        careers: resolve(root, 'careers.html'),
        aog: resolve(root, 'aog.html'),
        capabilityCheck: resolve(root, 'capability-check.html'),
        privacy: resolve(root, 'privacy.html'),
        terms: resolve(root, 'terms.html'),
        credits: resolve(root, 'credits.html'),
        // Protected internal module (noindex, not linked from the marketing pages).
        logs: resolve(root, 'logs.html'),
        // Holding page served at adpt.fpiservices.net until that app is handed over.
        adpt: resolve(root, 'adpt.html'),
      },
    },
  },
});
