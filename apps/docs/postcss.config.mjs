/* Tailwind 4 for the vendored AI Elements tier, and nothing else.

   The docs site's own chrome is hand-written CSS in site.css against
   @elirobinson/tokens, and stays that way. Tailwind is here because
   @elirobinson/ai-elements is Tailwind v4 markup — it is the consumer's
   framework, declared as a peer of that package, and a page that mounts a
   vendored component without it renders unstyled with no error at all. */
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
