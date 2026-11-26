import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Pruebas unitarias y de componentes del frontend web (Vitest + React Testing Library).
 * La cobertura se publica en coverage/lcov.info para SonarQube Cloud.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/features/*/domain/**/*.ts',
        'src/features/*/application/**/*.ts',
        'src/features/*/infrastructure/**/*.ts',
        'src/shared/infrastructure/**/*.ts',
        'src/shared/ui/Map/ecuadorMapMath.ts',
      ],
      exclude: ['**/index.ts', '**/*.test.*', 'src/test/**'],
    },
  },
});
