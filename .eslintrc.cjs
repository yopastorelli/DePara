module.exports = {
  root: true,
  env: {
    browser: true,
    commonjs: true,
    es2022: true,
    node: true,
    jest: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script'
  },
  ignorePatterns: [
    'coverage/',
    'node_modules/',
    'backups/',
    'data/',
    'logs/',
    'temp/'
  ],
  rules: {}
};
