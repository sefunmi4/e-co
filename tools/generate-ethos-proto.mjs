import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatesDir = path.join(root, "tools", "templates");
const outputDir = path.join(root, "apps", "web", "ethos", "frontend", "lib", "proto");

mkdirSync(outputDir, { recursive: true });

for (const file of ["ethos_pb.ts", "ethos_connect.ts"]) {
  const template = readFileSync(path.join(templatesDir, file), "utf8");
  writeFileSync(path.join(outputDir, file), template);
}

console.log("Generated Connect-Web stubs in", outputDir);
