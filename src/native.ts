export const isDesktop = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export async function nativeRequest(request: unknown, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { invoke } = await import("@tauri-apps/api/core");
  signal?.throwIfAborted();
  const id = crypto.randomUUID();
  const cancel = () => {
    void invoke("cancel_request", { id }).catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const result = await invoke("http_request", { id, request });
    signal?.throwIfAborted();
    return result;
  } catch (error) {
    signal?.throwIfAborted();
    throw Error(String(error));
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
export async function nativeUpdate(path: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  if (path === "status") return invoke("update_status");
  if (path === "check") {
    const release = await invoke<Record<string, unknown>>("check_update");
    if (typeof release.checkedAt === "number")
      release.checkedAt = new Date(release.checkedAt).toISOString();
    return release;
  }
  throw Error(
    "Desktop updates use the macOS DMG from the official release page.",
  );
}
export async function openRelease(url: string) {
  if (!isDesktop()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_release_page", { url });
}
