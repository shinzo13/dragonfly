export type Inline =
  | { kind: "text" | "bold" | "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "head"; line: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "para"; lines: Inline[][] };

const TOKEN =
  /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/g;
const BULLET = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;
const HEAD = /^#{1,6}\s+(.*)$/;
const LINES = /\r?\n/;

export function inline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [whole, bold, code, label, href, url] = match;
    if (match.index > last) {
      out.push({ kind: "text", text: text.slice(last, match.index) });
    }
    if (bold) {
      out.push({ kind: "bold", text: bold });
    } else if (code) {
      out.push({ kind: "code", text: code });
    } else {
      out.push({ href: href ?? url, kind: "link", text: label ?? url });
    }
    last = match.index + whole.length;
  }
  if (last < text.length) {
    out.push({ kind: "text", text: text.slice(last) });
  }
  return out;
}

export function blocks(notes: string): Block[] {
  const result: Block[] = [];
  let open: Block | null = null;
  for (const raw of notes.split(LINES)) {
    const line = raw.trimEnd();
    const head = line.match(HEAD);
    const bullet = line.match(BULLET);
    if (!line.trim()) {
      open = null;
    } else if (head) {
      result.push({ kind: "head", line: inline(head[1]) });
      open = null;
    } else if (bullet) {
      const ordered = Boolean(bullet[1]);
      if (open?.kind !== "list" || open.ordered !== ordered) {
        open = { items: [], kind: "list", ordered };
        result.push(open);
      }
      open.items.push(inline(bullet[2]));
    } else {
      if (open?.kind !== "para") {
        open = { kind: "para", lines: [] };
        result.push(open);
      }
      open.lines.push(inline(line));
    }
  }
  return result;
}
