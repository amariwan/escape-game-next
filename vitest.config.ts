import { defineConfig } from 'vitest/config'

export default defineConfig({
   test: {
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
      coverage: {
         provider: 'v8',
         include: ['lib/**/*.ts', 'app/api/**/*.ts'],
         exclude: ['lib/types.ts'],
         thresholds: {
            lines: 70,
            branches: 70,
         },
      },
   },
})
