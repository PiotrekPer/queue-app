// NativeWind v4 (Tailwind v3 semantics). Tokens come from the shared preset,
// which reads packages/ui-tokens/tokens.json (the single source of truth).
const tokensPreset = require('@stoliq/ui-tokens/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), tokensPreset],
  theme: {
    extend: {},
  },
  plugins: [],
};
