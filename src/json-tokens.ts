export type JsonToken = { text: string; kind?: "key" | "string" | "number" | "boolean" | "null" | "punctuation" };
export function jsonTokens(text: string): JsonToken[] {
  if (!/^\s*(?:[\[{"\d-]|true\b|false\b|null\b)/.test(text)) return [{text}];
  const pattern = /"(?:\\[\s\S]|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}\[\],:]/g;
  const tokens: JsonToken[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > end) tokens.push({text:text.slice(end,start)});
    const value = match[0];
    const kind: JsonToken["kind"] = value[0] === '"' ? /^\s*:/.test(text.slice(start+value.length)) ? "key" : "string" : /[\d-]/.test(value[0]) ? "number" : value === "null" ? "null" : value === "true" || value === "false" ? "boolean" : "punctuation";
    tokens.push({text:value,kind});
    end = start + value.length;
  }
  if (end < text.length) tokens.push({text:text.slice(end)});
  return tokens;
}
