import type { Plugin } from "vite";

/**
 * Replaces the `<%= mainScript %>` entry in index.html.
 *
 * This replaces vite-plugin-simple-html, which was only used for that
 * substitution: it depends on @swc/html, whose Linux native binding cannot be
 * loaded in Cloudflare Pages' build sandbox (ERR_SWC_NATIVE_CACHE). HTML
 * minification was the other thing it did; Vite still minifies JS and CSS.
 */
export const htmlEntry = (entry: string): Plugin => ({
  name: "html-entry",
  transformIndexHtml: {
    order: "pre",
    handler: (html) => html.replaceAll("<%= mainScript %>", entry),
  },
});
