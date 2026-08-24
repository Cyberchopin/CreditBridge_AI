import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourcePath = resolve(projectRoot, "dist/server/wrangler.json");
const outputPath = resolve(projectRoot, "dist/server/wrangler.external.json");
const databaseId = process.env.CREDITBRIDGE_D1_DATABASE_ID?.trim();

if (!databaseId) {
  throw new Error(
    "CREDITBRIDGE_D1_DATABASE_ID is required. Create the Cloudflare D1 database before preparing a deployment.",
  );
}

const generated = JSON.parse(await readFile(sourcePath, "utf8"));

const deployment = {
  ...generated,
  name: "creditbridge-ai",
  d1_databases: [
    {
      binding: "DB",
      database_name: "creditbridge-ai",
      database_id: databaseId,
      migrations_dir: "../../drizzle",
    },
  ],
  observability: {
    enabled: true,
    logs: {
      enabled: true,
      invocation_logs: true,
    },
  },
};

delete deployment.topLevelName;
delete deployment.dev;
delete deployment.build;

await writeFile(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
console.log(`Prepared ${outputPath}`);
