import { createECDH, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
const ref = process.argv[2];
if (!/^[a-z]{20}$/.test(ref || ""))
  throw Error("Indiquer la référence du projet Supabase (20 lettres).");
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const values = [
  ecdh.getPublicKey().toString("base64url"),
  ecdh.getPrivateKey().toString("base64url"),
  "https://github.com/CGIY/stck",
  randomBytes(32).toString("base64url"),
  `https://${ref}.supabase.co/functions/v1/push-dispatch`,
];
await fs.mkdir(".private", { recursive: true, mode: 0o700 });
const sql =
  "insert into stck_private.push_config(singleton,vapid_public,vapid_private,subject,dispatch_secret,function_url) values(true," +
  values.map((v) => "'" + v.replaceAll("'", "''") + "'").join(",") +
  ");\n";
await fs.writeFile(".private/push-config.sql", sql, {
  mode: 0o600,
  flag: "wx",
});
console.log(
  "Configuration créée dans .private/push-config.sql. Ne pas la publier.",
);
