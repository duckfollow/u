import { updateApi as api, type Release } from "./update-client";
import { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  GitBranch,
  ExternalLink,
  ArrowUpRight,
  Info,
} from "lucide-react";
type Job = {
  running: boolean;
  phase: string;
  message?: string;
  restartRequired?: boolean;
  version?: string;
};
export default function Updates({
  onBusy,
  initialRelease,
  onChecked,
}: {
  onBusy: (busy: boolean) => void;
  initialRelease: Release | null;
  onChecked: (release: Release) => void;
}) {
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
            ? { ...current, currentVersion: status.currentVersion }
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
  const disabled = working || job.running;
  const status =
    job.phase === "complete"
      ? "Restart to finish"
      : job.running
        ? "Updating u"
        : release?.state === "available"
          ? "A new version is available"
          : release?.state === "up-to-date"
            ? "You’re up to date"
            : release?.state === "no-release"
              ? "No release published yet"
              : release?.repository
                ? "Ready to check for updates"
                : "Connect your release source";
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <RefreshCw size={13} />
            KEEP YOUR WORKSHOP CURRENT
          </div>
          <h1>Updates</h1>
          <p>Check for new versions of u and install them on this machine.</p>
        </div>
        <button disabled={disabled} onClick={() => void check()}>
          <RefreshCw size={14} className={working ? "spin" : ""} />
          Check for updates
        </button>
      </div>
      <div className="updates-page">
        {error && (
          <div className="update-error" role="alert">
            {error}
          </div>
        )}
        <section className="update-hero">
          <div className="update-app-icon">u.</div>
          <div>
            <span className="update-kicker">U API STUDIO</span>
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
            <label className="field-label" htmlFor="update-repo">
              GITHUB REPOSITORY
            </label>
            <div className="update-source">
              <input
                id="update-repo"
                disabled={disabled}
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repository"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                disabled={disabled || !repo.trim()}
                onClick={() => void save()}
              >
                Save & check
                <ArrowUpRight size={13} />
              </button>
            </div>
            <small>
              Installation requires a clean project checkout connected to this
              same repository.
            </small>
          </section>
          <section className="update-card">
            <div className="update-card-title">
              <Download size={16} />
              <h3>Install an update</h3>
            </div>
            <p>
              The release is prepared and built separately before its files are
              applied. Saved flows and collections stay in this browser.
            </p>
            {release?.reason && (
              <div className="update-guidance">
                <Info size={15} />
                <span>{release.reason}</span>
              </div>
            )}
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
            <small>
              Restart u after installation. Local edits must be committed first.
            </small>
          </section>
        </div>
        {release?.notes && (
          <section className="update-card release-notes">
            <div className="update-card-title">
              <CheckCircle2 size={16} />
              <h3>What’s new in {release.latestVersion}</h3>
              {release.releaseUrl && (
                <a href={release.releaseUrl} target="_blank" rel="noreferrer">
                  View release
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <pre>{release.notes}</pre>
          </section>
        )}
        <div className="update-footnote">
          <Info size={13} />
          {release?.checkedAt
            ? `Last checked ${new Date(release.checkedAt).toLocaleString()}`
            : "No automatic downloads. You choose when to check and install."}
        </div>
      </div>
    </>
  );
}
