export type Release = {
  currentVersion: string;
  repository: string | null;
  state?: string;
  ready?: boolean;
  reason?: string;
  latestVersion?: string;
  tag?: string;
  notes?: string;
  releaseUrl?: string;
  checkedAt?: string;
};
export async function updateApi(path: string, data?: unknown) {
  const { token } = await fetch("/api/session").then((r) => r.json());
  const result = await fetch("/api/updates/" + path, {
    method: path === "status" ? "GET" : "POST",
    headers: { "X-U-Token": token, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await result.json();
  if (!result.ok) throw Error(body.error || "Update request failed");
  return body;
}
