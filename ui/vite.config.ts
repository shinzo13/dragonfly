import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import type { AtRule as AtRuleNode, Helpers, Rule } from "postcss";
import { defineConfig, loadEnv } from "vite";
import { isSpaPath } from "./src/lib/spa-paths.ts";

const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(",")
  : undefined;

const HOVER_MEDIA = "(hover: hover)";

const hoverOnly = {
  postcssPlugin: "hover-only",
  Rule(rule: Rule, { AtRule }: Helpers) {
    const inside = rule.parent?.type === "atrule" && (rule.parent as AtRuleNode).params === HOVER_MEDIA;
    if (inside || !rule.selector.includes(":hover")) {
      return;
    }
    const media = new AtRule({ name: "media", params: HOVER_MEDIA });
    rule.replaceWith(media);
    media.append(rule);
  },
};

const VITE_OWNED = "^/(?!@|src/|node_modules/|\\.svelte-kit/|__|_app/|favicon)";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const firefly = env.FIREFLY_URL ?? "http://127.0.0.1:8080";
  const sync = env.SYNC_URL ?? "http://127.0.0.1:38091";
  return {
    css: { postcss: { plugins: [hoverOnly] } },
    plugins: [
      tailwindcss(),
      sveltekit({
        adapter: adapter({
          assets: "build",
          fallback: "index.html",
          pages: "build",
          precompress: false,
          strict: false,
        }),
        preprocess: [vitePreprocess()],
      }),
    ],
    server: {
      allowedHosts,
      proxy: {
        "^/sync/": { target: sync },
        [VITE_OWNED]: {
          bypass(req) {
            const url = new URL(req.url ?? "/", "http://dev.local");
            const ffui = url.searchParams.get("ffui");
            const read = req.method === "GET" || req.method === "HEAD";
            const old = ffui === "old" || ffui === "off";
            return read && !old && isSpaPath(url.pathname)
              ? req.url
              : undefined;
          },
          target: firefly,
          xfwd: true,
        },
      },
    },
  };
});
