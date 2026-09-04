/* Vite resolves a stylesheet imported for its side effects; TypeScript does
   not, and there is no bundler-provided ambient declaration in this package. */
declare module '*.css';
