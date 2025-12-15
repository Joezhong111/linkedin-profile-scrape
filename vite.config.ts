import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [
      react(),
      {
        name: "dev-api-scrape",
        configureServer(server) {
          server.middlewares.use("/api/scrape", (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method Not Allowed");
              return;
            }

            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body || "{}");
                const urls = Array.isArray(parsed.urls) ? parsed.urls : [];
                const token =
                  process.env.APIFY_TOKEN || env.VITE_APIFY_TOKEN || "";
                if (!token) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "APIFY token missing" }));
                  return;
                }

                const ApifyModule: any = await import("apify-client");
                const ApifyClient =
                  ApifyModule.ApifyClient ||
                  ApifyModule.default?.ApifyClient ||
                  ApifyModule.default;

                const client = new ApifyClient({ token });
                const input = { profileUrls: urls };
                const run = await client.actor("2SyF0bVxmgGr8IVCZ").call(input);
                const { items } = await client
                  .dataset(run.defaultDatasetId)
                  .listItems();

                // Return raw Apify items for frontend preview
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(items));
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({ error: e?.message || "Scrape failed" })
                );
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
