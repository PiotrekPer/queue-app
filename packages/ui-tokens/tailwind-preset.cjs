/**
 * Tailwind preset consumed by the staff app's NativeWind config.
 * Plain CommonJS so a `tailwind.config.js` (evaluated by Node/Metro) can require it
 * with zero build step. Reads the same tokens.json that the web CSS is generated from.
 */
const tokens = require('./tokens.json');

/** camelCase → kebab-case for utility class names. */
const kebab = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const fontSize = {};
for (const [k, v] of Object.entries(tokens.type.scale)) {
  fontSize[kebab(k)] = `${v}px`;
}

const borderRadius = {};
for (const [k, v] of Object.entries(tokens.radius)) {
  borderRadius[k] = k === 'pill' ? '9999px' : `${v}px`;
}

const spacing = {};
for (const [k, v] of Object.entries(tokens.touch)) {
  spacing[`touch-${kebab(k)}`] = `${v}px`;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: tokens.color,
      borderRadius,
      spacing,
      fontFamily: {
        display: [tokens.type.display],
        ui: [tokens.type.ui],
        mono: [tokens.type.mono],
      },
      fontSize,
    },
  },
};
