import { descendants } from "./collection-tree.ts";
import type { RequestSpec, Workspace } from "./model.ts";

export type DocumentationScope = { kind: "collection"; id: string } | { kind: "folder"; name: string };
export function documentationGroups(workspace: Workspace, scope: DocumentationScope) {
  const ids = scope.kind === "collection" ? descendants(workspace.collections ?? [], scope.id) : new Set<string>();
  const collections = scope.kind === "folder"
    ? (workspace.collections ?? []).filter(c => c.folder === scope.name)
    : scope.id === "" ? [{id: "", name: "Unfiled"}] : (workspace.collections ?? []).filter(c => ids.has(c.id));
  if (scope.kind === "collection") collections.sort((a,b) => Number(b.id === scope.id) - Number(a.id === scope.id));
  return collections.map(collection => ({
    ...collection,
    requests: workspace.requests.filter(r => (r.collectionId ?? "") === collection.id),
  }));
}
export function requestVariables(request: RequestSpec): string[] {
  return [...new Set([request.url, request.headers, request.body, request.auth].flatMap(value =>
    [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(match => match[1].trim()),
  ))];
}
