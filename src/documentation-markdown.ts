import type { RequestSpec, Workspace } from "./model.ts";
import { documentationGroups, requestVariables, type DocumentationScope } from "./collection-docs.ts";
import { responseExamples } from "./response-examples.ts";

function text(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/[\\`*_{}\[\]<>#!|]/g, "\\$&");
}
function code(value: string, language = ""): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map(m => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}
function body(value: unknown): string {
  return typeof value === "string" ? code(value) : code(JSON.stringify(value, null, 2), "json");
}
function requestMarkdown(request: RequestSpec): string {
  const parts = [`### ${text(request.method)} · ${text(request.name || "Untitled request")}`, "#### URL", code(request.url)];
  if (request.description) parts.push("#### Description", code(request.description));
  if (request.url.includes("?")) {
    const params = [...new URLSearchParams(request.url.split("?").slice(1).join("?").split("#")[0])];
    if (params.length) parts.push("#### Query parameters", ...params.map(([key, value]) => `- **${text(key)}**\n\n${code(value)}`));
  }
  parts.push("#### Authorization", request.auth ? `Bearer token:\n\n${code(request.auth)}` : "No Bearer token configured. See URL, headers and body for other authorization methods.");
  parts.push("#### Headers", code(request.headers || "{}", "json"), "#### Request body", request.body ? code(request.body) : "No request body.");
  const variables = requestVariables(request);
  if (variables.length) parts.push("#### Variables", code(variables.map(v => `{{${v}}}`).join("\n")), "Variables are shown as saved; environment values are not resolved.");
  const examples = responseExamples(request);
  parts.push("#### Response examples");
  if (!examples.length) parts.push("No response examples saved.");
  for (const example of examples) {
    parts.push(`##### ${text(example.name)}`, `**Status:** ${example.status} ${text(example.statusText)}`, "**Response headers**", code(JSON.stringify(example.headers, null, 2), "json"), "**Response body**", example.body === "" ? "No response body." : body(example.body));
  }
  return parts.join("\n\n");
}
export function exportDocumentationMarkdown(workspace: Workspace, scope: DocumentationScope): {filename: string; content: string} {
  const groups = documentationGroups(workspace, scope);
  const title = scope.kind === "folder" ? scope.name : groups[0]?.name ?? "Collection";
  const count = groups.reduce((total, group) => total + group.requests.length, 0);
  const parts = [`# ${text(title)}`, `API documentation · ${groups.length} collections · ${count} requests`, "Generated from saved request configuration. Response examples are illustrative demos or saved snapshots, not live responses."];
  for (const group of groups) parts.push(`## ${text(group.name)}`, group.requests.length ? group.requests.map(requestMarkdown).join("\n\n---\n\n") : "No requests in this collection.");
  if (!groups.length) parts.push("No collections in this scope.");
  const slug = title.normalize("NFKC").replace(/[^\p{L}\p{N}_-]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80) || "collection";
  return {filename:`${slug}-api-documentation.md`, content:parts.join("\n\n") + "\n"};
}
