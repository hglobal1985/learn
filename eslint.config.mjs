import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default [
 {ignores:['**/dist/**','**/.wrangler/**','**/.expo/**','**/node_modules/**','**/.build-tests/**']},
 {linterOptions:{reportUnusedDisableDirectives:'off'}},
 js.configs.recommended,
 ...tseslint.configs.recommended,
 {files:['**/*.ts','**/*.tsx'],languageOptions:{globals:{...globals.browser,...globals.node,...globals.serviceworker}}},
 {files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['warn',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},
 {files:['**/*.tsx','**/*.ts'],plugins:{'react-hooks':{rules:{'exhaustive-deps':{create:()=>({})}}}},rules:{'no-control-regex':'off','no-irregular-whitespace':'off','@typescript-eslint/no-require-imports':'off','@typescript-eslint/no-unused-expressions':'off'}},
 {files:['**/*.mjs'],languageOptions:{globals:globals.node}}
];
