// Flat Config — Next 16 empfiehlt eslint-config-next direkt (kein `next lint` mehr).
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
   ...nextVitals,
   ...nextTs,
   // Test-Dateien: kein react-compiler-Overhead, globals für node bereitstellen
   {
      files: ['tests/**/*', 'playwright/**/*'],
      rules: {
         '@next/next/no-img-element': 'off',
      },
   },
   globalIgnores(['.next/', 'node_modules/', 'coverage/', 'test-results/', 'playwright-report/', 'next-env.d.ts']),
])
