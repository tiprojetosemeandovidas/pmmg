'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['public/data/**'] },
  js.configs.recommended,
  {
    files: ['api/**/*.js', 'lib/**/*.js', 'tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: Object.assign({}, globals.node, { fetch: 'readonly' }) },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  },
  {
    files: ['public/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: globals.browser }
  }
];
