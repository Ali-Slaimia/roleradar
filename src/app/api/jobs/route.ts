import { z } from "zod";
import { loadJobs } from "@/lib/jobs/aggregate";
import { scoreJob } from "@/lib/jobs/match";
import { PROFILE } from "@/lib/profile";
import { json } from "@/lib/security/headers";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const JOB_SOURCES = [
  {
    id: "remotive",
    name: "Remotive",
    url: "https://remotive.com/remote-jobs",
    api: "https://remotive.com/api/remote-jobs",
    focus: "Remote software jobs worldwide",
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
    focus: "Remote jobs by skill tags",
  },
] as const;

const schema = z.object({
  q: z.string().trim().max(80).optional(),
  europe: z.enum(["0", "1"]).optional(),
  tunisia: z.enum(["0", "1"]).optional(),
  visa: z.enum(["0", "1"]).optional(),
  remote: z.enum(["0", "1"]).optional(),
  source: z.string().trim().max(20).optional(),
  refresh: z.enum(["0", "1"]).optional(),
  skills: z.string().trim().max(800).optional(),
});

export async function GET(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`jobs:${ip}`, 30);
  if (!rl.ok) return json({ error: "Too many refreshes — wait a minute" }, 429);

  const url = new URL(req.url);
  const parsed = schema.safeParse({
    q: url.searchParams.get("q") || undefined,
    europe: url.searchParams.get("europe") || undefined,
    tunisia: url.searchParams.get("tunisia") || undefined,
    visa: url.searchParams.get("visa") || undefined,
    remote: url.searchParams.get("remote") || undefined,
    source: url.searchParams.get("source") || undefined,
    refresh: url.searchParams.get("refresh") || undefined,
    skills: url.searchParams.get("skills") || undefined,
  });
  if (!parsed.success) return json({ error: "Invalid query" }, 400);

  const skills = parsed.data.skills
    ? parsed.data.skills
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40)
    : PROFILE.skills;

  const result = await loadJobs({
    q: parsed.data.q,
    europe: parsed.data.europe === "1",
    tunisia: parsed.data.tunisia === "1",
    visa: parsed.data.visa === "1",
    remote: parsed.data.remote === "1",
    source: parsed.data.source,
    refresh: parsed.data.refresh === "1",
  });

  const jobs = result.jobs.map((job) => ({
    ...job,
    description: job.description.slice(0, 400),
    match: scoreJob(job, skills),
  }));

  jobs.sort((a, b) => b.match.score - a.match.score);

  return json({
    generatedAt: new Date().toISOString(),
    ...result,
    jobs,
    scoredWithSkills: skills,
    sourcesCatalog: JOB_SOURCES,
    method:
      "Live listings from Remotive, RemoteOK, Arbeitnow, and Jobicy public APIs. Match score = skills overlap + Europe/visa/remote signals vs your confirmed profile (CV scan or default). Not affiliated with employers.",
  });
}
