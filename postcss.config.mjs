// Tailwind v4 über PostCSS — Next 16 braucht diesen Eintrag,
// damit `@import "tailwindcss"` in app/globals.css greift.
const config = {
   plugins: {
      '@tailwindcss/postcss': {},
   },
}

export default config
