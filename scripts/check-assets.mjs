import fs from "node:fs/promises";
import path from "node:path";
const files = await fs.readdir("dist");
const missing = [];
for (const file of files.filter((f) => /\.(html|css|js)$/.test(f))) {
  const content = await fs.readFile("dist/" + file, "utf8");
  for (const match of content.matchAll(
    /(?:assets\/[\w.-]+\.(?:webp|png|svg)|(?:href|src)="([\w.-]+\.(?:js|css|html|webmanifest|png|svg))(?:\?[^\"]*)?")/g,
  )) {
    const target = match[1] || match[0];
    try {
      await fs.access(path.join("dist", target));
    } catch {
      missing.push(file + ": " + target);
    }
  }
}
if (missing.length) throw Error(missing.join("\n"));
console.log("All packaged asset references resolve.");
