import {
  FIREFLY_PREFIXES,
  SPA_EXACT,
  SPA_PREFIXES,
} from "../src/lib/spa-paths.ts";

const PER_LINE = 6;

function lines(keyword: string, paths: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < paths.length; i += PER_LINE) {
    out.push(`\t\t${keyword} ${paths.slice(i, i + PER_LINE).join(" ")}`);
  }
  return out;
}

const pages = [...SPA_EXACT, ...SPA_PREFIXES.map((prefix) => `${prefix}*`)];
const firefly = FIREFLY_PREFIXES.map((prefix) => `${prefix}*`);

console.log(
  [
    "\t@ffui_pages {",
    "\t\tmethod GET HEAD",
    ...lines("path", pages),
    ...lines("not path", firefly),
    '\t\tnot expression `{query.ffui} in ["off", "old"] || ({cookie.ffui} == "off" && {query.ffui} != "on")`',
    "\t}",
  ].join("\n")
);
