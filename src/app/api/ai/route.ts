import { z } from "zod";
import { getJobById } from "@/lib/jobs/aggregate";
import { aiMatchExplain, buildApplyPack, buildInterviewPack } from "@/lib/ai/packs";
import { json } from "@/lib/security/headers";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { looksLikePromptInjection } from "@/lib/security/sanitize";

const schema = z.object({
  jobId: z.string().trim().min(3).max(120),
  mode: z.enum(["match", "apply", "interview"]),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`ai:${ip}`, 12);
  if (!rl.ok) return json({ error: "AI rate limit — try again shortly" }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: "Provide jobId + mode" }, 400);

  if (looksLikePromptInjection(parsed.data.jobId)) {
    return json({ error: "Rejected input" }, 400);
  }

  const job = await getJobById(parsed.data.jobId);
  if (!job) return json({ error: "Job not found — refresh the board first" }, 404);
  if (looksLikePromptInjection(job.description.slice(0, 500))) {
    return json({ error: "Listing text failed safety screen" }, 400);
  }

  if (parsed.data.mode === "match") {
    return json({ jobId: job.id, ...(await aiMatchExplain(job)) });
  }
  if (parsed.data.mode === "apply") {
    return json({ jobId: job.id, pack: await buildApplyPack(job) });
  }
  return json({ jobId: job.id, pack: await buildInterviewPack(job) });
}
