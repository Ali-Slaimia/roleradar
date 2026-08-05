import { PROFILE } from "@/lib/profile";
import type { Job } from "@/lib/jobs/types";

export type MatchResult = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  flags: {
    europe: boolean;
    visa: boolean;
    tunisiaFriendly: boolean;
    remote: boolean;
  };
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreJob(job: Job, skills = PROFILE.skills): MatchResult {
  const blob = `${job.title} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of skills) {
    const s = skill.toLowerCase();
    const hit =
      blob.includes(s) ||
      (s === "next.js" && blob.includes("nextjs")) ||
      (s === "node.js" && (blob.includes("nodejs") || blob.includes("node ")));
    if (hit) matched.push(skill);
    else if (["TypeScript", "React", "Next.js", "Node.js", "Spring Boot", "Python"].includes(skill))
      missing.push(skill);
  }

  const titleBoost = /junior|graduate|entry|mid|fullstack|full-stack|frontend|backend/i.test(
    job.title,
  )
    ? 8
    : 0;
  const geoBoost =
    (job.europeSignal ? 12 : 0) +
    (job.visaSignal ? 10 : 0) +
    (job.tunisiaFriendly ? 6 : 0) +
    (job.remote ? 5 : 0);

  const skillScore = Math.min(55, matched.length * 7);
  const score = Math.max(5, Math.min(99, skillScore + geoBoost + titleBoost));

  const reasons: string[] = [];
  if (matched.length)
    reasons.push(`Skills overlap: ${matched.slice(0, 6).join(", ")}`);
  if (job.europeSignal) reasons.push("Europe / EU-remote signal in listing");
  if (job.visaSignal) reasons.push("Visa / relocation language detected");
  if (job.tunisiaFriendly) reasons.push("Worldwide / MENA / relocation-friendly wording");
  if (!matched.length) reasons.push("Low hard-skill overlap — still review for adjacent roles");

  // soft missing: skills in profile core not in job
  const coreMissing = PROFILE.skills
    .filter((s) => !matched.includes(s))
    .filter((s) =>
      tokenize(job.description).some((t) => t.length > 3 && s.toLowerCase().includes(t)),
    )
    .slice(0, 0);

  return {
    score,
    matchedSkills: matched,
    missingSkills: [...new Set([...missing, ...coreMissing])].slice(0, 8),
    reasons,
    flags: {
      europe: job.europeSignal,
      visa: job.visaSignal,
      tunisiaFriendly: job.tunisiaFriendly,
      remote: job.remote,
    },
  };
}
