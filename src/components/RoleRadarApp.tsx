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

type JobsPayload = {
  jobs: Job[];
  total: number;
  notices: string[];
  sources: string[];
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
};

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

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (europe) params.set("europe", "1");
        if (tunisia) params.set("tunisia", "1");
        if (visa) params.set("visa", "1");
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/jobs?${params}`);
        const json = (await res.json()) as JobsPayload;
        if (!res.ok) throw new Error(json.error || "Failed to load jobs");
        setData(json);
        if (json.jobs[0]) {
          setSelected(
            (prev) => (prev && json.jobs.find((j) => j.id === prev.id)) || json.jobs[0],
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
      }
    },
    [q, europe, tunisia, visa],
  );

  useEffect(() => {
    load(false);
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => setProfile(j.profile))
      .catch(() => null);
  }, [load]);

  async function runAi(mode: "apply" | "interview" | "match") {
    if (!selected) return;
    setAiBusy(mode);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selected.id, mode: mode === "match" ? "match" : mode }),
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

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
      <header className="glass rounded-3xl p-6 md:p-8">
        <p className="pill">Tunisia → Europe · live listings · AI apply packs</p>
        <h1 className="display mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
          RoleRadar
        </h1>
        <p className="mt-3 max-w-3xl text-base text-[var(--muted)] md:text-lg">
          Real remote/EU job feeds scored against{" "}
          <strong className="text-[var(--ink)]">{profile?.name || "Ali Slaimia"}</strong>
          &apos;s stack — then AI drafts cover letters, CV bullets, and interview prep. Local AI
          fallback works without an API key.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(profile?.projects || []).map((p) => (
            <a key={p.name} href={p.url || "#"} className="pill !normal-case !tracking-normal" target="_blank" rel="noreferrer">
              {p.name}
            </a>
          ))}
        </div>
      </header>

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
          <span>Sources: {(data?.sources || []).join(", ") || "—"}</span>
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
                  <a className="btn btn-accent" href={selected.url} target="_blank" rel="noreferrer">
                    Open listing
                  </a>
                  <button className="btn" onClick={() => runAi("apply")} disabled={!!aiBusy}>
                    {aiBusy === "apply" ? "Drafting…" : "AI apply pack"}
                  </button>
                  <button className="btn" onClick={() => runAi("interview")} disabled={!!aiBusy}>
                    {aiBusy === "interview" ? "Preparing…" : "Interview prep"}
                  </button>
                </div>
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
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                    Apply pack · {applyPack.model}
                  </p>
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
