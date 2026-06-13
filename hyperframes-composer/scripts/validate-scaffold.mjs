import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function expectFile(file) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing file: ${file}`);
}

function expectDir(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) errors.push(`missing directory: ${dir}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    errors.push(`invalid json: ${file} (${error.message})`);
    return {};
  }
}

for (const file of ["hyperframes.json", "package.json", ".gitignore", ".env.example", "README.md"]) {
  expectFile(file);
}

for (const dir of ["assets", "blocks", "components", "manifests", "schemas", "scripts", "render", "audit"]) {
  expectDir(dir);
}

const hf = readJson("hyperframes.json");
if (hf?.paths?.blocks !== "blocks") errors.push("hyperframes paths.blocks must be blocks");
if (hf?.paths?.components !== "components") errors.push("hyperframes paths.components must be components");
if (hf?.paths?.assets !== "assets") errors.push("hyperframes paths.assets must be assets");

const pkg = readJson("package.json");
if (pkg.type !== "module") errors.push("package must be type=module");
for (const script of ["validate:scaffold", "validate:manifest", "compose", "lint", "inspect", "render"]) {
  if (!pkg.scripts?.[script]) errors.push(`package missing script: ${script}`);
}

const readme = fs.existsSync(path.join(root, "README.md")) ? fs.readFileSync(path.join(root, "README.md"), "utf8") : "";
for (const heading of ["Component Library", "Manifest Driven Composition", "Phases"]) {
  if (!readme.includes(heading)) errors.push(`README missing heading text: ${heading}`);
}

if (errors.length) {
  console.error(errors.map((error) => `FAIL: ${error}`).join("\n"));
  process.exit(1);
}

console.log("hyperframes-composer scaffold validation passed");
