import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "node_modules/@lucide/svelte/dist/icons";
const DATA = /__iconData = (\{.*?\});\n/s;

const out: Record<string, unknown> = {};
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".svelte"))) {
  const match = readFileSync(`${DIR}/${file}`, "utf8").match(DATA);
  if (match) {
    const data = JSON.parse(match[1]);
    out[data.name] = data.node;
  }
}
writeFileSync("src/lib/v2/lucide.json", JSON.stringify(out));
console.log(Object.keys(out).length);
