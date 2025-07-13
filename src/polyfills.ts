// This file is used to polyfill features that are not available in all environments.
// It is imported in next.config.ts to ensure it is loaded early.

if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  (window as any).global = window;
}

if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = require('buffer').Buffer;
}
