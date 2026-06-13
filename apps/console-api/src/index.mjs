import http from "node:http";
import path from "node:path";
import { createApiServer, loadEnvFiles } from "./server.mjs";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const composerRoot = path.join(repoRoot, "hyperframes-composer");
const env = {
  ...loadEnvFiles([path.join(appRoot, ".env.local"), path.join(repoRoot, ".env.local"), path.join(composerRoot, ".env.local")]),
  ...process.env,
};
const port = Number(env.PORT || env.CONSOLE_API_PORT || 4099);
// Bind to loopback by default; only listen on all interfaces when HOST is set
// explicitly (e.g. HOST=0.0.0.0). Avoids unintentionally exposing the import API.
const host = env.HOST || "127.0.0.1";

const server = http.createServer(
  createApiServer({
    composerRoot,
    logDir: path.join(appRoot, "logs"),
    env,
  }),
);

server.listen(port, host, () => {
  console.log(`console-api listening on http://${host}:${port}`);
});
