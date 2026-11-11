// Поиск похожих обращений без ML: пересечение значимых слов.
// Слова приводятся к нижнему регистру и обрезаются до 5 букв (грубая замена стемминга),
// служебные и «формульные» слова обращений отбрасываются.

const STOP = new Set(
  `предл можно нужен нужна нужно нужны хотел чтобы котор иногд всегд также очень после перед между
   этого такой такую такие таких более может могут полез будет было были когда какие какой какую
   через сейча тольк неско этот этих свои своих него если либо даже часто просто
   стало стать иметь есть`.split(/\s+/),
);

export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/)) {
    if (raw.length < 4) continue;
    const stem = raw.slice(0, 5);
    if (!STOP.has(stem)) out.add(stem);
  }
  return out;
}

export type SimDoc = { id: number; categoryId: number; tokens: Set<string> };

/** Доля общих слов от меньшего текста, 0..1. Требуется минимум три общих слова. */
export function similarity(a: SimDoc, b: SimDoc): number {
  const [small, big] = a.tokens.size <= b.tokens.size ? [a.tokens, b.tokens] : [b.tokens, a.tokens];
  if (small.size === 0) return 0;
  let shared = 0;
  for (const t of small) if (big.has(t)) shared++;
  if (shared < 3) return 0;
  return shared / small.size;
}

export const SIMILARITY_THRESHOLD = 0.2;

/** Группы похожих обращений: связные компоненты графа «похожести». */
export function clusters(docs: SimDoc[]): number[][] {
  const parent = new Map<number, number>(docs.map((d) => [d.id, d.id]));
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      if (similarity(docs[i], docs[j]) >= SIMILARITY_THRESHOLD) parent.set(find(docs[i].id), find(docs[j].id));
    }
  }
  const groups = new Map<number, number[]>();
  for (const d of docs) {
    const r = find(d.id);
    groups.set(r, [...(groups.get(r) ?? []), d.id]);
  }
  return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
}
