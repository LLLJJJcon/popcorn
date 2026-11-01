import styles from "./practice-workspace.module.css";
// Hirschberg's LCS identifies exact character edits with linear working memory.
// This also keeps long, unchanged answer sections out of the highlighted edits.
function lcsLengths(a: readonly string[], b: readonly string[]): Uint16Array {
  const row = new Uint16Array(b.length + 1);
  for (const character of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j]!;
      row[j] = character === b[j - 1] ? diagonal + 1 : Math.max(row[j]!, row[j - 1]!);
      diagonal = previous;
    }
  }
  return row;
}
function matchingCharacters(a: readonly string[], b: readonly string[], startA = 0, startB = 0): Array<readonly [number, number]> {
  if (a.length === 0 || b.length === 0) return [];
  if (a.length === 1) { const found = b.indexOf(a[0]!); return found < 0 ? [] : [[startA, startB + found]]; }
  const alphabet = new Set(b);
  if (!a.some(character => alphabet.has(character))) return [];
  const mid = Math.floor(a.length / 2);
  const first = lcsLengths(a.slice(0, mid), b);
  const last = lcsLengths(a.slice(mid).reverse(), [...b].reverse());
  let split = 0, best = -1;
  for (let j = 0; j <= b.length; j++) { const score = first[j]! + last[b.length - j]!; if (score > best) { best = score; split = j; } }
  return [...matchingCharacters(a.slice(0, mid), b.slice(0, split), startA, startB), ...matchingCharacters(a.slice(mid), b.slice(split), startA + mid, startB + split)];
}
export function characterDifference(left: string, right: string) {
  const a = [...left], b = [...right];
  const pairs = matchingCharacters(a, b);
  const sameA = new Set(pairs.map(pair => pair[0])), sameB = new Set(pairs.map(pair => pair[1]));
  return [a.map((text, index) => ({ text, changed: !sameA.has(index) })), b.map((text, index) => ({ text, changed: !sameB.has(index) }))];
}
export function AnswerComparison({ first, second, firstLabel = "Your answer", secondLabel = "A natural version" }: { readonly first: string; readonly second: string; readonly firstLabel?: string; readonly secondLabel?: string }) {
  const parts = characterDifference(first, second);
  return <div className={styles.comparisonGrid}>{[firstLabel, secondLabel].map((label, side) => <section key={label}><h3>{label}</h3><p lang="zh-CN">{parts[side]!.map((part, i) => part.changed ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</p></section>)}</div>;
}
