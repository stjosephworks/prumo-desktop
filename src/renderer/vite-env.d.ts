/// <reference types="vite/client" />

// Vite turns a CSS import into a side effect; TypeScript needs to be told it exists.
declare module '*.css'
