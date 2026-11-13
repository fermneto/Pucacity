import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'shots/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Simulação pura: sem Three.js, sem DOM, sem aleatoriedade não determinística.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'core/ não pode depender do Three.js (ver docs/engineering.md §0).' },
            { group: ['**/render/*', '**/ui/*'], message: 'core/ não pode importar render/ nem ui/.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use Rng (core/Rng.ts) para manter a simulação determinística.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core/ não pode usar DOM.' },
        { name: 'document', message: 'core/ não pode usar DOM.' },
      ],
    },
  },
  {
    // Scripts de build/captura rodam no Node (e o screenshots.mjs avalia código no navegador).
    files: ['scripts/**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
