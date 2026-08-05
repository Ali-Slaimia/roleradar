"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Match = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  flags: { europe: boolean; visa: boolean; tunisiaFriendly: boolean; remote: boolean };
};

type Job = {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  tags: string[];
  salary: string | null;
  remote: boolean;
  europeSignal: boolean;
  tunisiaFriendly: boolean;
  visaSignal: boolean;
  publishedAt: string | null;
  match: Match;
};

type SourceInfo = {
  id: string;
  name: string;
  url: string;
  api: string;
  focus: string;
};

type JobsPayload = {
  jobs: Job[];
  total: number;
  notices: string[];
  sources: string[];
  sourcesCatalog?: SourceInfo[];
  scoredWithSkills?: string[];
  fromCache: boolean;
  method: string;
  error?: string;
};

type ApplyPack = {
  model: string;
  match: Match;
  elevatorPitch: string;
  coverLetter: string;
  whyYouFit: string[];
  cvBullets: string[];
  outreachDm: string;
  risks: string[];
};

type InterviewPack = {
  model: string;
  questions: Array<{ q: string; tip: string }>;
  storyBank: string[];
};

type Profile = {
  name: string;
  title: string;
  location: string;
  target: string;
  skills: string[];
  highlights: string[];
  projects: Array<{ name: string; blurb: string; url?: string }>;
  languages?: string[];
  email?: string | null;
  confidence?: string;
};

const PROFILE_KEY = "roleradar-confirmed-profile";

export function RoleRadarApp() {
  const [q, setQ] = useState("");
  const [europe, setEurope] = useState(true);
  const [tunisia, setTunisia] = useState(false);
  const [visa, setVisa] = useState(false);
  const [data, setData] = useState<JobsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [applyPack, setApplyPack] = useState<ApplyPack | null>(null);
  const [interview, setInterview] = useState<InterviewPack | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvModel, setCvModel] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const activeSkills = draft?.skills?.length
    ? draft.skills
    : profile?.skills || [];

  const load = useCallback(
    async (refresh = false, skillsOverride?: string[]) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (europe) params.set("europe", "1");
        if (tunisia) params.set("tunisia", "1");
        if (visa) params.set("visa", "1");
        if (refresh) params.set("refresh", "1");
        const skills = skillsOverride || activeSkills;
        if (skills.length) params.set("skills", skills.join("|"));
        const res = await fetch(`/api/jobs?${params}`);
        const json = (await res.json()) as JobsPayload;
        if (!res.ok) throw new Error(json.error || "Failed to load jobs");
        setData(json);
        if (json.jobs[0]) {
          setSelected(
            (prev) => (prev && json.jobs.find((j) => j.id === prev.id)) || json.jobs[0],
          );
        } else {
          setSelected(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
      }
    },
    [q, europe, tunisia, visa, activeSkills],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Profile;
        setProfile(saved);
        setDraft(saved);
        setConfirmed(true);
      }
    } catch {
      /* ignore */
    }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => {
        setProfile((prev) => prev || j.profile);
        setDraft((prev) => prev || j.profile);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  async function scanCv() {
    setAiBusy("cv");
    setError(null);
    try {
      let res: Response;
      if (cvFile) {
        const form = new FormData();
        form.set("file", cvFile);
        if (cvText.trim()) form.set("text", cvText.trim());
        res = await fetch("/api/cv/parse", { method: "POST", body: form });
      } else {
        res = await fetch("/api/cv/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cvText }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "CV scan failed");
      setDraft(json.draft);
      setCvModel(json.model);
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CV scan failed");
    } finally {
      setAiBusy(null);
    }
  }

  async function confirmProfile() {
    if (!draft) return;
    setProfile(draft);
    setConfirmed(true);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    setApplyPack(null);
    setInterview(null);
    await load(false, draft.skills);
  }

  async function runAi(mode: "apply" | "interview") {
    if (!selected) return;
    setAiBusy(mode);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selected.id, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI failed");
      if (mode === "apply") setApplyPack(json.pack);
      if (mode === "interview") setInterview(json.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiBusy(null);
    }
  }

  const avg = useMemo(() => {
    if (!data?.jobs.length) return 0;
    return Math.round(data.jobs.reduce((s, j) => s + j.match.score, 0) / data.jobs.length);
  }, [data]);

  const catalog = data?.sourcesCatalog || [];

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
      <header className="glass rounded-3xl p-6 md:p-8">
        <p className="pill">Tunisia → Europe · live listings · CV scan · AI apply packs</p>
        <h1 className="display mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
          RoleRadar
        </h1>
        <p className="mt-3 max-w-3xl text-base text-[var(--muted)] md:text-lg">
          Upload your CV → AI extracts your profile → you confirm → we re-rank compatible jobs from
          live boards. Then draft cover letters and hit Apply on the real listing.
        </p>
      </header>

      <section className="glass rounded-3xl p-4 md:p-5">
        <h2 className="display text-xl font-bold">Where jobs come from</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Real public APIs — not seeded demo data. Click through to each board.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(catalog.length
            ? catalog
            : [
                {
                  id: "remotive",
                  name: "Remotive",
                  url: "https://remotive.com/remote-jobs",
                  api: "https://remotive.com/api/remote-jobs",
                  focus: "Remote software jobs",
                },
                {
                  id: "remoteok",
                  name: "RemoteOK",
                  url: "https://remoteok.com",
                  api: "https://remoteok.com/api",
                  focus: "Remote tech roles",
                },
                {
                  id: "arbeitnow",
                  name: "Arbeitnow",
                  url: "https://www.arbeitnow.com",
                  api: "https://www.arbeitnow.com/api/job-board-api",
                  focus: "Europe-focused board",
                },
                {
                  id: "jobicy",
                  name: "Jobicy",
                  url: "https://jobicy.com",
                  api: "https://jobicy.com/api/v2/remote-jobs",
                  focus: "Remote jobs by skill",
                },
              ]
          ).map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-[var(--line)] bg-black/20 p-4 hover:border-[var(--accent)]"
            >
              <p className="display font-bold">{s.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{s.focus}</p>
              <p className="mt-2 text-[10px] text-[var(--accent)]">
                {(data?.sources || []).includes(s.id) ? "active this fetch" : "source"}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-4 md:p-5">
        <h2 className="display text-xl font-bold">1. Scan your CV</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          PDF / TXT / MD or paste text. AI extracts skills & highlights — nothing is saved until you
          confirm.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">
            Paste CV text
            <textarea
              className="field mt-1 min-h-[140px]"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV here…"
            />
          </label>
          <div className="space-y-3">
            <label className="block text-sm text-[var(--muted)]">
              Or upload file (PDF, TXT, MD · max 4MB)
              <input
                className="field mt-1"
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              />
            </label>
            {cvFile ? (
              <p className="text-sm text-[var(--accent)]">Selected: {cvFile.name}</p>
            ) : null}
            <button
              className="btn btn-accent"
              onClick={scanCv}
              disabled={!!aiBusy || (!cvText.trim() && !cvFile)}
            >
              {aiBusy === "cv" ? "Scanning…" : "Scan CV with AI"}
            </button>
            {cvModel ? (
              <p className="text-xs text-[var(--muted)]">Parser: {cvModel}</p>
            ) : null}
          </div>
        </div>

        {draft ? (
          <div className="mt-5 rounded-2xl border border-[var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="display text-lg font-bold">2. Confirm extracted profile</h3>
              {confirmed ? (
                <span className="pill !border-[var(--accent)] !text-[var(--accent)]">
                  Confirmed — ranking jobs
                </span>
              ) : (
                <span className="pill">Needs your confirmation</span>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field
                label="Name"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />
              <Field
                label="Title"
                value={draft.title}
                onChange={(v) => setDraft({ ...draft, title: v })}
              />
              <Field
                label="Location"
                value={draft.location}
                onChange={(v) => setDraft({ ...draft, location: v })}
              />
              <Field
                label="Target"
                value={draft.target}
                onChange={(v) => setDraft({ ...draft, target: v })}
              />
            </div>
            <label className="mt-3 block text-sm text-[var(--muted)]">
              Skills (comma-separated)
              <input
                className="field mt-1"
                value={draft.skills.join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    skills: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label className="mt-3 block text-sm text-[var(--muted)]">
              Highlights (one per line)
              <textarea
                className="field mt-1 min-h-[100px]"
                value={draft.highlights.join("\n")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    highlights: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-accent" onClick={confirmProfile} disabled={!draft.skills.length}>
                Confirm → show compatible jobs
              </button>
              <button
                className="btn"
                onClick={() => {
                  localStorage.removeItem(PROFILE_KEY);
                  setConfirmed(false);
                }}
              >
                Clear saved profile
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="glass rounded-3xl p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm text-[var(--muted)]">
            Search
            <input
              className="field mt-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="typescript, spring, react native…"
              onKeyDown={(e) => e.key === "Enter" && load(false)}
            />
          </label>
          <div className="flex flex-wrap gap-2 pb-1">
            <Toggle label="Europe signal" on={europe} set={setEurope} />
            <Toggle label="TN / worldwide friendly" on={tunisia} set={setTunisia} />
            <Toggle label="Visa wording" on={visa} set={setVisa} />
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => load(false)} disabled={loading}>
              {loading ? "Loading…" : "Filter"}
            </button>
            <button className="btn btn-accent" onClick={() => load(true)} disabled={loading}>
              Refresh feeds
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
          <span>
            Showing <strong className="text-[var(--ink)]">{data?.jobs.length ?? "—"}</strong>
            {data ? ` / ${data.total}` : ""}
          </span>
          <span>
            Avg match <strong className="score">{avg || "—"}</strong>
          </span>
          <span>
            Scoring with{" "}
            <strong className="text-[var(--ink)]">
              {(data?.scoredWithSkills || activeSkills).slice(0, 5).join(", ") || "default profile"}
            </strong>
            {(data?.scoredWithSkills || activeSkills).length > 5 ? "…" : ""}
          </span>
          {data?.fromCache ? <span>cache</span> : <span>live fetch</span>}
        </div>
        {data?.notices?.length ? (
          <p className="mt-3 text-sm text-[var(--accent2)]">{data.notices.join(" · ")}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="glass rounded-3xl p-3 md:p-4">
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {(data?.jobs || []).map((job) => (
              <button
                key={job.id}
                onClick={() => {
                  setSelected(job);
                  setApplyPack(null);
                  setInterview(null);
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selected?.id === job.id
                    ? "border-[var(--accent)] bg-[rgba(46,196,182,0.08)]"
                    : "border-[var(--line)] hover:border-[var(--accent)]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="display text-lg font-bold">{job.title}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <p className="display score text-2xl font-extrabold">{job.match.score}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="pill">{job.source}</span>
                  {job.remote ? <span className="pill">remote</span> : null}
                  {job.europeSignal ? <span className="pill">europe</span> : null}
                  {job.visaSignal ? <span className="pill">visa?</span> : null}
                  {job.match.matchedSkills.slice(0, 3).map((s) => (
                    <span key={s} className="pill !normal-case !tracking-normal">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <a
                    className="btn btn-accent !py-1.5 !text-xs"
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apply
                  </a>
                </div>
              </button>
            ))}
            {!loading && !data?.jobs.length ? (
              <p className="p-4 text-sm text-[var(--muted)]">No jobs matched — loosen filters.</p>
            ) : null}
          </div>
        </section>

        <section className="glass rounded-3xl p-5">
          {!selected ? (
            <p className="text-[var(--muted)]">Select a role to generate an AI apply pack.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Selected role
                </p>
                <h2 className="display mt-1 text-2xl font-extrabold">{selected.title}</h2>
                <p className="text-[var(--muted)]">
                  {selected.company} · {selected.location}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {selected.description}
                  {selected.description.length >= 400 ? "…" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    className="btn btn-accent"
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apply on {selected.source}
                  </a>
                  <button
                    className="btn"
                    onClick={async () => {
                      await runAi("apply");
                      window.open(selected.url, "_blank", "noopener,noreferrer");
                    }}
                    disabled={!!aiBusy}
                  >
                    {aiBusy === "apply" ? "Drafting…" : "Draft pack + Apply"}
                  </button>
                  <button className="btn" onClick={() => runAi("interview")} disabled={!!aiBusy}>
                    {aiBusy === "interview" ? "Preparing…" : "Interview prep"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Apply opens the real board/employer page — RoleRadar cannot submit to their ATS.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] p-4">
                <p className="text-sm text-[var(--muted)]">Match score</p>
                <p className="display score text-4xl font-extrabold">{selected.match.score}/100</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {selected.match.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              {applyPack ? (
                <div className="space-y-3 rounded-2xl border border-[var(--accent)]/40 bg-[rgba(46,196,182,0.07)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                      Apply pack · {applyPack.model}
                    </p>
                    <a
                      className="btn btn-accent !py-1.5 !text-xs"
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Apply now
                    </a>
                  </div>
                  <Block title="Elevator pitch" text={applyPack.elevatorPitch} />
                  <Block title="Cover letter" text={applyPack.coverLetter} />
                  <List title="Why you fit" items={applyPack.whyYouFit} />
                  <List title="CV bullets" items={applyPack.cvBullets} />
                  <Block title="Short DM / outreach" text={applyPack.outreachDm} />
                  <List title="Watch-outs" items={applyPack.risks} />
                </div>
              ) : null}

              {interview ? (
                <div className="space-y-3 rounded-2xl border border-[var(--line)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent2)]">
                    Interview prep · {interview.model}
                  </p>
                  {interview.questions.map((item) => (
                    <div key={item.q}>
                      <p className="font-bold">{item.q}</p>
                      <p className="text-sm text-[var(--muted)]">{item.tip}</p>
                    </div>
                  ))}
                  <List title="Story bank" items={interview.storyBank} />
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <p className="px-1 pb-6 text-xs text-[var(--muted)]">{data?.method}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm text-[var(--muted)]">
      {label}
      <input className="field mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Toggle({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`pill !normal-case !tracking-normal ${on ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`}
      onClick={() => set(!on)}
    >
      {label}
    </button>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{title}</p>
        <button
          className="text-xs text-[var(--accent)]"
          onClick={() => navigator.clipboard.writeText(text)}
        >
          Copy
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-sm leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
