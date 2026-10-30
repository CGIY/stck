import fs from "node:fs/promises";
import { build } from "esbuild";
import sharp from "sharp";
const preview = process.argv.includes("--preview");
let local = JSON.parse(await fs.readFile("config.public.json", "utf8"));
try {
  local = {
    ...local,
    ...JSON.parse(await fs.readFile("config.local.json", "utf8")),
  };
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const config = {
  supabaseUrl: process.env.STCK_SUPABASE_URL || local.supabaseUrl || "",
  supabaseKey: process.env.STCK_SUPABASE_KEY || local.supabaseKey || "",
};
if (!preview && (!config.supabaseUrl || !config.supabaseKey))
  throw Error(
    "Renseigner STCK_SUPABASE_URL et STCK_SUPABASE_KEY avant une publication.",
  );
if (config.supabaseKey.startsWith("sb_secret_"))
  throw Error("Une clé serveur ne doit jamais être publiée.");
if (config.supabaseKey.startsWith("eyJ")) {
  const claims = JSON.parse(
    Buffer.from(config.supabaseKey.split(".")[1], "base64url"),
  );
  if (claims.role !== "anon")
    throw Error("Seules les clés publiques sont autorisées.");
}
if (
  config.supabaseUrl &&
  !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)
)
  throw Error("Adresse Supabase invalide.");
await fs.rm("dist", { recursive: true, force: true });
await fs.cp("web", "dist", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["safari16.4"],
  outfile: "dist/app.js",
});
await fs.writeFile(
  "dist/config.js",
  "window.STCK_CONFIG=" + JSON.stringify(config) + ";\n",
);
for (const size of [192, 512])
  await sharp("web/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`dist/icon-${size}.png`);
await fs.writeFile("dist/.nojekyll", "");
console.log(
  preview
    ? "Aperçu compilé (services distants non garantis)."
    : "Version publiable compilée.",
);
