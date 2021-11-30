module.exports = {
  env: {
    browser: true,
    // jest: true,
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended',
    'prettier',
  ],
  // Ignore patterns are set in .eslintignore
  // ignorePatterns: [ ],
  plugins: [
    'react',
    'jsx-a11y',
    '@typescript-eslint/eslint-plugin',
    'no-only-tests',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  root: true,
  rules: {
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'warn',
    'no-unreachable': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-key': 'warn',
    'react/no-unescaped-entities': 'off',
    // Typescript checks this.
    'import/named': 'off',
    // Have to turn off the base rull as it can report incorrect errors with typescript apparently
    'no-unused-vars': 'off',
    'no-only-tests/no-only-tests': 'error',
    'prefer-const': 'warn',
    'import/order': [
      'warn',
      {
        alphabetize: {
          order:
            'asc' /* sort in ascending order. Options: ['ignore', 'asc', 'desc'] */,
          caseInsensitive: true /* ignore case. Options: [true, false] */,
        },
        'newlines-between': 'always',

        pathGroups: [
          {
            pattern: '@gammatech/**',
            group: 'external',
            position: 'after',
          },
        ],

        groups: [
          'builtin', // Built-in types are first
          'external',
          'internal',
          ['sibling', 'parent'], // Then sibling and parent types. They can be mingled together
          'index', // Then the index file
          'object',
          // Then the rest
        ],
      },
    ],
    // Conflicts with Next's recommended way to create links.
    'jsx-a11y/anchor-is-valid': 'off',
    // Typescript rules
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/require-array-sort-compare': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-object-literal-type-assertion': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/array-type': 'off',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      typescript: {
        project: 'packages/*/tsconfig.json',
      },
    },
    react: {
      version: 'detect',
    },
    polyfills: ['Promise'],
  },
}
