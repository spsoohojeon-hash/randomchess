import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  // Local development and builds do not require Cloudflare authentication.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    plugins: [
      vinext(),
      cloudflare({
        configPath: "./wrangler.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        persistState: { path: ".wrangler/state" },
        inspectorPort: false,
      }),
    ],
  };
});
