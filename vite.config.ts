import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const VIRTUAL_ENTRY = 'virtual:agent-office-entry';
const RESOLVED_VIRTUAL_ENTRY = `\0${VIRTUAL_ENTRY}`;

export default defineConfig(({ mode }) => {
  const syntheticDemo = mode === 'test-demo';
  const entryPath = path.resolve(
    import.meta.dirname,
    syntheticDemo ? 'src/ui/demo-entry.tsx' : 'src/ui/runtime/entry.tsx',
  );
  const exportName = syntheticDemo ? 'mountSyntheticTestDemo' : 'mountProductionRuntime';
  return {
    plugins: [
      {
        name: 'agent-office-explicit-ui-entry',
        resolveId(source) {
          return source === VIRTUAL_ENTRY ? RESOLVED_VIRTUAL_ENTRY : null;
        },
        load(id) {
          return id === RESOLVED_VIRTUAL_ENTRY
            ? `export { ${exportName} as mountAgentOffice } from ${JSON.stringify(entryPath)};`
            : null;
        },
      },
      react(),
    ],
    server: {
      host: '127.0.0.1',
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      strictPort: true,
    },
    build: {
      outDir: 'dist/dashboard',
      emptyOutDir: true,
    },
  };
});
