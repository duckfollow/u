export function formatJson(input: string): string {
  JSON.parse(input); // Validate without re-serializing numbers, duplicate keys or escapes.
  const tokens = input.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g) ?? [];
  let depth = 0;
  let output = "";
  const newline = () => { output += "\n" + "  ".repeat(depth); };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "{" || token === "[") {
      output += token;
      depth++;
      if (tokens[i + 1] !== (token === "{" ? "}" : "]")) newline();
    } else if (token === "}" || token === "]") {
      depth--;
      if (tokens[i - 1] !== (token === "}" ? "{" : "[")) newline();
      output += token;
    } else if (token === ",") { output += token; newline(); }
    else if (token === ":") output += ": ";
    else output += token;
  }
  return output;
}
export function jsonFormatError(input: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Invalid JSON";
  const position = message.match(/position\s+(\d+)/i);
  if (position) {
    const preceding = input.slice(0, Number(position[1]));
    const line = preceding.split("\n").length;
    const column = preceding.length - preceding.lastIndexOf("\n");
    return `Invalid JSON at line ${line}, column ${column}. ${message}`;
  }
  return `Could not format JSON. ${message}`;
}
