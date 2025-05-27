// .eslintrc.js
module.exports = {
  // The parser that allows ESLint to understand TypeScript syntax
  parser: '@typescript-eslint/parser',

  // The plugins that provide the rules
  plugins: [
    '@typescript-eslint'
    // ...other plugins like 'react'
  ],

  // Extending recommended rule sets is the best practice
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // Enables TypeScript rules
    'next/core-web-vitals' // Enables Next.js specific rules
  ],

  rules: {
    // You can override or add rules here if needed
    // For example, the warnings you see could be handled:
    'react-hooks/exhaustive-deps': 'warn',
    '@next/next/no-img-element': 'warn',
  },
};