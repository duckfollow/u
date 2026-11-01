import { createPortal } from "react-dom";
import "./updates-dialog.css";
import { isDesktop, openRelease } from "./native";
import { updateApi as api, type Release } from "./update-client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  GitBranch,
  ExternalLink,
  ArrowUpRight,
  Info,
  X,
} from "lucide-react";
const companionIcons: Record<string, string> = {
  edith: new URL("./assets/companion-apps/edith.png", import.meta.url).href,
  "dum-e": new URL("./assets/companion-apps/dum-e.png", import.meta.url).href,
  ultron: new URL("./assets/companion-apps/ultron.png", import.meta.url).href,
};
type Job = {
  running: boolean;
  phase: string;
  message?: string;
  restartRequired?: boolean;
  version?: string;
};
export default function Updates({
  onClose,
  onBusy,
  initialRelease,
  onChecked,
}: {
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  initialRelease: Release | null;
  onChecked: (release: Release) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const [release, setRelease] = useState<Release | null>(initialRelease),
    [job, setJob] = useState<Job>({ running: false, phase: "idle" }),
    [repo, setRepo] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (initialRelease) setRelease(initialRelease);
  }, [initialRelease]);
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const status = await api("status");
        if (!alive) return;
        setJob(status);
        onBusy(status.running);
        setRelease((current) =>
          current
            ? {
                ...current,
                runtime: status.runtime,
                currentVersion: status.currentVersion,
              }
            : status,
        );
        setRepo((current) => current || status.repository || "");
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [onBusy]);
  async function check() {
    setWorking(true);
    setError("");
    try {
      const checked = await api("check");
      setRelease(checked);
      onChecked(checked);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function save() {
    setWorking(true);
    setError("");
    try {
      const result = await api("source", { repository: repo });
      setRepo(result.repository);
      setRelease((current) => ({
        ...current!,
        repository: result.repository,
        state: undefined,
        reason: undefined,
      }));
      const checked = await api("check");
      setRelease(checked);
      onChecked(checked);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function install() {
    setWorking(true);
    setError("");
    try {
      const result = await api("install", { tag: release?.tag });
      setJob(result);
      onBusy(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  const currentReleaseUrl =
    release?.releaseUrl ??
    (release?.currentVersion
      ? `https://github.com/duckfollow/u/releases/tag/v${release.currentVersion}`
      : undefined);
  const disabled = working || job.running;
  const status =
    job.phase === "complete"
      ? "Restart to finish"
      : job.running
        ? "Updating u"
        : working
          ? "Checking for updates…"
          : release?.state === "available"
            ? "A new version is available"
            : release?.state === "up-to-date"
              ? "You’re up to date"
              : release?.state === "no-release"
                ? "No release published yet"
                : release?.repository
                  ? "Ready to check for updates"
                  : "Connect your release source";
  return createPortal(
    <dialog
      ref={dialog}
      className="u-updates-dialog"
      aria-labelledby="u-updates-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!job.running) onClose();
      }}
    >
      <header className="u-updates-heading">
        <div>
          <div className="eyebrow">
            <RefreshCw size={13} />
            KEEP U CURRENT
          </div>
          <h1 id="u-updates-title">Updates</h1>
          <p>Check for new versions and see what’s changed.</p>
        </div>
        <button
          className="u-updates-close"
          aria-label="Close updates"
          disabled={job.running}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="updates-page">
        {error && (
          <div className="update-error" role="alert">
            {error}
          </div>
        )}
        <section className="update-hero" aria-live="polite">
          <div className="update-app-icon">u.</div>
          <div>
            <span className="update-kicker">
              {isDesktop() ? "U FOR MACOS" : "U API STUDIO"}
            </span>
            <h2>{status}</h2>
            <p>
              Installed version{" "}
              <strong>{release?.currentVersion ?? "Loading…"}</strong>
              {release?.latestVersion && (
                <>
                  {" "}
                  <span className="update-arrow">→</span> Latest{" "}
                  <strong>{release.latestVersion}</strong>
                </>
              )}
            </p>
          </div>
          <span className="update-channel">Stable channel</span>
        </section>
        <div className="u-updates-toolbar">
          <button disabled={disabled} onClick={() => void check()}>
            <RefreshCw size={14} className={working ? "spin" : ""} />
            {working ? "Checking…" : "Check for updates"}
          </button>
        </div>
        {job.phase !== "idle" && (
          <section
            className={`update-job ${job.phase === "failed" ? "failed" : ""}`}
            role="status"
          >
            <div>
              {job.running ? (
                <RefreshCw size={17} className="spin" />
              ) : job.phase === "complete" ? (
                <CheckCircle2 size={17} />
              ) : (
                <Info size={17} />
              )}
              <strong>
                {job.phase === "complete"
                  ? "Installation complete"
                  : job.phase === "failed"
                    ? "Update could not finish"
                    : job.phase[0].toUpperCase() + job.phase.slice(1)}
              </strong>
            </div>
            <p>{job.message}</p>
            {job.running && <progress aria-label="Update in progress" />}
            {job.phase === "complete" && (
              <p>
                Stop u and start it again with your usual launch command, then
                reload this page.
              </p>
            )}
          </section>
        )}
        <div className="updates-grid">
          <section className="update-card">
            <div className="update-card-title">
              <GitBranch size={16} />
              <h3>Release source</h3>
            </div>
            <p>
              Use the GitHub repository that owns this project. u checks at
              startup; you can also check manually.
            </p>
            {isDesktop() ? (
              <div className="u-release-source">duckfollow/u</div>
            ) : (
              <>
                <label className="field-label" htmlFor="update-repo">
                  GITHUB REPOSITORY
                </label>
                <div className="update-source">
                  <input
                    id="update-repo"
                    disabled={disabled || release?.runtime === "desktop"}
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="owner/repository"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    disabled={
                      disabled || !repo.trim() || release?.runtime === "desktop"
                    }
                    onClick={() => void save()}
                  >
                    Save & check
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </>
            )}
            <small>
              {release?.runtime === "desktop"
                ? "Stable releases come from the official u GitHub repository."
                : "Installation requires a clean project checkout connected to this same repository."}
            </small>
          </section>
          <section className="update-card">
            <div className="update-card-title">
              <Download size={16} />
              <h3>Install an update</h3>
            </div>
            <p>
              {release?.runtime === "desktop"
                ? "Download the latest macOS DMG and replace u in Applications. Your saved workspace stays in this app."
                : "The release is prepared and built separately before its files are applied. Saved flows and collections stay in this browser."}
            </p>
            {release?.reason && (
              <div className="update-guidance">
                <Info size={15} />
                <span>{release.reason}</span>
              </div>
            )}
            {isDesktop() ? (
              <a
                className="desktop-download primary"
                href={currentReleaseUrl}
                aria-disabled={!currentReleaseUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (isDesktop()) {
                    event.preventDefault();
                    if (currentReleaseUrl)
                      void openRelease(currentReleaseUrl).catch((e) =>
                        setError(String(e)),
                      );
                  }
                }}
              >
                <Download size={14} />
                {release?.state === "available"
                  ? "Download macOS update"
                  : "View current release"}
              </a>
            ) : (
              <button
                className="primary"
                disabled={
                  disabled ||
                  release?.state !== "available" ||
                  !release.ready ||
                  job.phase === "complete"
                }
                onClick={() => void install()}
              >
                <Download size={14} />
                {job.running
                  ? "Updating…"
                  : release?.latestVersion
                    ? `Update to ${release.latestVersion}`
                    : "Install update"}
              </button>
            )}
            <small>
              {release?.runtime === "desktop"
                ? "Quit u before replacing the app, then open it again."
                : "Restart u after installation. Local edits must be committed first."}
            </small>
          </section>
        </div>
        {release?.notes && (
          <section className="update-card release-notes">
            <div className="update-card-title">
              <CheckCircle2 size={16} />
              <h3>What’s new in {release.latestVersion}</h3>
              {release.releaseUrl && (
                <a
                  href={release.releaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (isDesktop()) {
                      event.preventDefault();
                      void openRelease(release.releaseUrl!).catch((e) =>
                        setError(String(e)),
                      );
                    }
                  }}
                >
                  View release
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <pre>{release.notes}</pre>
          </section>
        )}
        <section
          className="u-updates-discover"
          aria-labelledby="u-discover-title"
        >
          <h3 id="u-discover-title">More from duckfollow</h3>
          <p>A few more tools for your workshop.</p>
          <div className="u-updates-companions">
            {[
              {
                id: "edith",
                name: "EDITH",
                category: "DEBUGGING",
                description:
                  "Inspect HTTP traffic, route requests, and explore logs in one workbench.",
              },
              {
                id: "dum-e",
                name: "Dum-E",
                category: "DATABASES",
                description:
                  "Browse PostgreSQL and SQLite databases, edit tables, and run SQL.",
              },
              {
                id: "ultron",
                name: "Ultron",
                category: "SSH WORKBENCH",
                description:
                  "Connect to servers, manage SSH sessions, and keep terminal work organized.",
              },
            ].map((app) => (
              <article key={app.id}>
                <div className="u-companion-brand">
                  <img
                    src={companionIcons[app.id]}
                    alt=""
                    width={40}
                    height={40}
                  />
                  <div>
                    <span>{app.category}</span>
                    <h4>{app.name}</h4>
                  </div>
                </div>
                <p>{app.description}</p>
                <a
                  href={`https://github.com/duckfollow/${app.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (!isDesktop()) return;
                    event.preventDefault();
                    void import("@tauri-apps/api/core")
                      .then(({ invoke }) =>
                        invoke("open_companion_app", { app: app.id }),
                      )
                      .catch(() =>
                        setError(
                          `Could not open ${app.name}. Please try again.`,
                        ),
                      );
                  }}
                >
                  Learn more <ExternalLink size={12} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <div className="update-footnote">
          <Info size={13} />
          {release?.checkedAt
            ? `Last checked ${new Date(release.checkedAt).toLocaleString()}. No automatic downloads.`
            : "No automatic downloads. You choose when to check and install."}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
