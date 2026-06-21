module.exports = [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'backups/**',
      'data/**',
      'logs/**',
      'temp/**',
      'test-results/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs'
    }
  }
];
