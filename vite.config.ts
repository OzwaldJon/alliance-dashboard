import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Alliance Dashboard',
        namespace: 'https://cncapp*.alliances.commandandconquer.com/*/index.aspx*',
        version: '0.2.3',
        description:
          'Alliance dashboard for Tiberium Alliances: Players roster, Teams, Targets, POI, Chat logs, Diagnostics.',
        author: 'OzwaldJon',
        match: ['https://*.alliances.commandandconquer.com/*/index.aspx*'],
        grant: 'none',
        'run-at': 'document-end'
      },
      build: {
        fileName: 'AllianceDashboard.user.js'
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      format: {
        comments: /==UserScript==/i
      }
    },
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true
      }
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
});
