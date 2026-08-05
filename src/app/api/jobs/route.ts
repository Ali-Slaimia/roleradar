import { z } from "zod";
import { loadJobs } from "@/lib/jobs/aggregate";
import { scoreJob } from "@/lib/jobs/match";
import { json } from "@/lib/security/headers";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  q: z.string().trim().max(80).optional(),
  europe: z.enum(["0", "1"]).optional(),
  tunisia: z.enum(["0", "1"]).optional(),
  visa: z.enum(["0", "1"]).optional(),
  remote: z.enum(["0", "1"]).optional(),
  source: z.string().trim().max(20).optional(),
  refresh: z.enum(["0", "1"]).optional(),
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
  });
  if (!parsed.success) return json({ error: "Invalid query" }, 400);

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
    match: scoreJob(job),
  }));

  jobs.sort((a, b) => b.match.score - a.match.score);

  return json({
    generatedAt: new Date().toISOString(),
    ...result,
    jobs,
    method:
      "Listings from Remotive, RemoteOK, Arbeitnow, Jobicy (public APIs). Match score = skills overlap + Europe/visa/remote signals vs Ali Slaimia profile. Not affiliated with employers.",
  });
}
