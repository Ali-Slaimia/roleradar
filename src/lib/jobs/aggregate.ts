import type { Job } from "@/lib/jobs/types";
import { dedupeJobs } from "@/lib/jobs/normalize";
import {
  fetchArbeitnow,
  fetchJobicy,
  fetchRemoteOk,
  fetchRemotive,
} from "@/lib/jobs/sources";
import { promises as fs } from "fs";
import path from "path";

type CacheFile = {
  fetchedAt: number;
  jobs: Job[];
  notices: string[];
  sources: string[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const CACHE_FILE = path.join(DATA_DIR, "jobs-cache.json");
const TTL_MS = 20 * 60 * 1000;

async function readCache(): Promise<CacheFile | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
}

async function writeCache(payload: CacheFile) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(payload));
  } catch {
    /* optional */
  }
}

export type JobQuery = {
  q?: string;
  europe?: boolean;
  tunisia?: boolean;
  visa?: boolean;
  remote?: boolean;
  source?: string;
  refresh?: boolean;
};

export async function loadJobs(query: JobQuery = {}) {
  const cached = await readCache();
  const freshEnough = cached && Date.now() - cached.fetchedAt < TTL_MS;
  let jobs = cached?.jobs || [];
  let notices = cached?.notices || [];
  let sources = cached?.sources || [];
  let fromCache = !!freshEnough;

  if (!freshEnough || query.refresh) {
    const results = await Promise.allSettled([
      fetchRemotive(),
      fetchRemoteOk(),
      fetchArbeitnow(),
      fetchJobicy(),
    ]);
    const next: Job[] = [];
    const nextNotices: string[] = [];
    const nextSources: string[] = [];
    const names = ["remotive", "remoteok", "arbeitnow", "jobicy"] as const;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        next.push(...r.value);
        nextSources.push(names[i]);
      } else {
        nextNotices.push(
          `${names[i]}: ${r.reason instanceof Error ? r.reason.message : "failed"}`,
        );
      }
    });
    jobs = dedupeJobs(next);
    notices = nextNotices;
    sources = nextSources;
    fromCache = false;
    await writeCache({ fetchedAt: Date.now(), jobs, notices, sources });
  }

  let filtered = jobs.filter((j) => {
    if (query.europe && !(j.europeSignal || /europe|eu|germany|france|netherlands|uk|ireland|spain|portugal|sweden|poland/i.test(j.location)))
      return false;
    if (query.tunisia && !j.tunisiaFriendly && !j.visaSignal && !j.remote) return false;
    if (query.visa && !j.visaSignal) return false;
    if (query.remote && !j.remote) return false;
    if (query.source && j.source !== query.source) return false;
    if (query.q) {
      const q = query.q.toLowerCase();
      const blob = `${j.title} ${j.company} ${j.location} ${j.tags.join(" ")} ${j.description}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  // Prefer tech-ish roles when no query
  if (!query.q) {
    const techish = filtered.filter((j) =>
      /engineer|developer|software|fullstack|full-stack|frontend|backend|react|typescript|node|java|python|devops/i.test(
        `${j.title} ${j.tags.join(" ")}`,
      ),
    );
    if (techish.length >= 8) filtered = techish;
  }

  filtered.sort((a, b) => {
    const score = (j: Job) =>
      (j.europeSignal ? 3 : 0) +
      (j.visaSignal ? 2 : 0) +
      (j.tunisiaFriendly ? 1 : 0) +
      (j.remote ? 1 : 0);
    return score(b) - score(a);
  });

  return {
    jobs: filtered.slice(0, 80),
    total: filtered.length,
    notices,
    sources,
    fromCache,
    fetchedAt: cached && fromCache ? cached.fetchedAt : Date.now(),
  };
}

export async function getJobById(id: string) {
  const { jobs } = await loadJobs({});
  return jobs.find((j) => j.id === id) || null;
}
