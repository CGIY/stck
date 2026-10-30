import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const file = path.resolve(
        root,
        "." +
          decodeURIComponent(url.pathname) +
          (url.pathname.endsWith("/") ? "index.html" : ""),
      );
      if (!file.startsWith(root + path.sep)) throw Error();
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Introuvable");
    }
  })
  .listen(4173, "127.0.0.1", () => console.log("STCK : http://127.0.0.1:4173"));
