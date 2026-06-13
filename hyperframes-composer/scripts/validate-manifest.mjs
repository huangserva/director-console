import path from "node:path";
import { loadJson, validateManifest } from "./manifest-rules.mjs";

const root = process.cwd();
const manifestPath = path.resolve(root, process.argv[2] || "manifests/memos-v3.json");
const manifest = loadJson(manifestPath);
const failures = validateManifest(manifest, { root, manifestPath });

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`hyperframes-composer manifest validation passed: ${path.relative(root, manifestPath)}`);
