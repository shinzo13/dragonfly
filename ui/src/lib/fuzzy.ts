const SEPARATOR = /[\s/·-]/;

export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  if (!q) {
    return 1;
  }
  const t = text.toLowerCase();
  const direct = t.indexOf(q);
  if (direct !== -1) {
    const wordStart = direct === 0 || SEPARATOR.test(t[direct - 1]);
    return 1000 - direct + (wordStart ? 200 : 0) - t.length * 0.1;
  }
  let score = 0;
  let position = -1;
  let streak = 0;
  for (const char of q) {
    if (char === " ") {
      continue;
    }
    const next = t.indexOf(char, position + 1);
    if (next === -1) {
      return 0;
    }
    streak = next === position + 1 ? streak + 1 : 0;
    score += 10 + streak * 5 - (next - position) * 0.5;
    position = next;
  }
  return Math.max(score, 1);
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  text: (item: T) => string,
  limit = 50
): T[] {
  if (!query.trim()) {
    return items.slice(0, limit);
  }
  return items
    .map((item) => ({ item, score: fuzzyScore(query, text(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
