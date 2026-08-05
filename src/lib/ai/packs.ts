import { PROFILE } from "@/lib/profile";
import type { Job } from "@/lib/jobs/types";
import { scoreJob, type MatchResult } from "@/lib/jobs/match";
import { clip, redactSecrets } from "@/lib/security/sanitize";

export type ApplyPack = {
  model: string;
  match: MatchResult;
  elevatorPitch: string;
  coverLetter: string;
  whyYouFit: string[];
  cvBullets: string[];
  outreachDm: string;
  risks: string[];
};

export type InterviewPack = {
  model: string;
  questions: Array<{ q: string; tip: string }>;
  storyBank: string[];
};

function localApplyPack(job: Job, match: MatchResult): ApplyPack {
  const skills = match.matchedSkills.slice(0, 5).join(", ") || PROFILE.skills.slice(0, 5).join(", ");
  const project = PROFILE.projects[0];
  return {
    model: "roleradar-local-v1",
    match,
    elevatorPitch: `${PROFILE.name} — ${PROFILE.title} from ${PROFILE.location}. I ship full-stack products with ${skills}, recently ${project.name} (${project.blurb}). Targeting ${PROFILE.target}, excited about ${job.title} at ${job.company}.`,
    coverLetter: `Dear ${job.company} hiring team,\n\nI'm ${PROFILE.name}, a ${PROFILE.title} based in ${PROFILE.location}, applying for ${job.title}. I build end-to-end web products in TypeScript/React/Next.js and Java/Spring, with a focus on real data, AI features, and API security.\n\nRecently I shipped ${project.name}: ${project.blurb}${project.url ? ` (${project.url})` : ""}. At Visolus (Paris) I contributed to GOLRI and helped improve recommendation accuracy by ~25%. I'm fluent in English and French and actively targeting Europe-friendly roles${job.visaSignal ? ", including teams open to visa/relocation support" : ""}.\n\nI'd love to bring that builder energy to ${job.company}. Happy to share a short walkthrough of SkyPulse or a take-home sample.\n\nBest regards,\n${PROFILE.name}\n${PROFILE.location}`,
    whyYouFit: [
      `Overlap with listing skills: ${skills || "adjacent full-stack stack"}`,
      match.flags.europe
        ? "Listing shows Europe / EU-remote signals aligned with your target market"
        : "Remote-first listing — workable from Tunisia with async collaboration",
      `Proof projects: ${PROFILE.projects.map((p) => p.name).join(", ")}`,
      `Languages: ${PROFILE.languages.join(", ")} — useful for EU teams`,
    ],
    cvBullets: [
      `Built ${project.name} — ${project.blurb}`,
      "Integrated AI-assisted features and secured third-party API proxies (rate limits, Zod, CSP)",
      "Full-stack delivery across React/Next.js and Spring Boot with cloud-ready deploys",
      match.matchedSkills.length
        ? `Hands-on with ${match.matchedSkills.slice(0, 4).join(", ")} relevant to this role`
        : "Strong generalist full-stack profile ready to ramp on role-specific tools",
    ],
    outreachDm: `Hi — I'm Ali, full-stack engineer (TN → EU). Built SkyPulse (live ADS-B + AI briefs) and shipped GOLRI features in Paris. Interested in ${job.title} at ${job.company} — open to a quick chat?`,
    risks: [
      ...(match.score < 45
        ? ["Match score is modest — tailor the letter to adjacent skills and learning speed"]
        : []),
      ...(match.missingSkills.length
        ? [`Listing may expect: ${match.missingSkills.slice(0, 4).join(", ")}`]
        : []),
      "Always verify visa/relocation policy on the company careers page before applying",
    ],
  };
}

function localInterview(job: Job): InterviewPack {
  return {
    model: "roleradar-local-v1",
    questions: [
      {
        q: `Walk me through a production feature you owned that relates to ${job.title}.`,
        tip: "Use SkyPulse: problem → ADS-B proxies → delay proxy honesty → deploy.",
      },
      {
        q: "How do you secure server routes that call third-party APIs?",
        tip: "Rate limit, Zod validation, CSP, never expose keys to the browser.",
      },
      {
        q: "Tell me about collaborating remotely across timezones.",
        tip: "Paris internship + Tunisia base — async updates, clear demos, written RFCs.",
      },
      {
        q: "Where have you used AI in a product responsibly?",
        tip: "Local fallback, no invented facts, prompt-injection screening.",
      },
      {
        q: `Why ${job.company} and this role?`,
        tip: "Tie company domain to your builder proof (maps, AI, full-stack shipping).",
      },
    ],
    storyBank: PROFILE.highlights,
  };
}

async function openaiJson<T>(system: string, user: string): Promise<T | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return { ...(JSON.parse(content) as T), model: data.model || "openai" } as T;
  } catch {
    return null;
  }
}

export async function buildApplyPack(job: Job): Promise<ApplyPack> {
  const match = scoreJob(job);
  const local = localApplyPack(job, match);
  const cloud = await openaiJson<ApplyPack>(
    "You help Ali Slaimia (Tunisia → Europe full-stack engineer) apply to jobs. Return JSON keys: elevatorPitch, coverLetter, whyYouFit (string[]), cvBullets (string[]), outreachDm, risks (string[]). Be specific, honest, no fabricated employers. English.",
    redactSecrets(
      `PROFILE: ${JSON.stringify(PROFILE)}\nMATCH: ${JSON.stringify(match)}\nJOB: ${JSON.stringify({
        title: job.title,
        company: job.company,
        location: job.location,
        tags: job.tags,
        description: clip(job.description, 3500),
        url: job.url,
      })}`,
    ),
  );
  if (!cloud) return local;
  return {
    ...local,
    ...cloud,
    match,
    model: typeof cloud.model === "string" ? cloud.model : "openai",
  };
}

export async function buildInterviewPack(job: Job): Promise<InterviewPack> {
  const local = localInterview(job);
  const cloud = await openaiJson<InterviewPack>(
    "Return JSON: questions (array of {q, tip}), storyBank (string[]). Interview prep for Ali Slaimia applying to this role. Practical, junior/mid level.",
    redactSecrets(
      `PROFILE highlights: ${PROFILE.highlights.join(" | ")}\nJOB: ${job.title} @ ${job.company}\nDESC: ${clip(job.description, 2500)}`,
    ),
  );
  if (!cloud) return local;
  return {
    model: typeof cloud.model === "string" ? cloud.model : "openai",
    questions: cloud.questions?.length ? cloud.questions : local.questions,
    storyBank: cloud.storyBank?.length ? cloud.storyBank : local.storyBank,
  };
}

export async function aiMatchExplain(job: Job) {
  const match = scoreJob(job);
  const cloud = await openaiJson<{ summary: string; nextSteps: string[] }>(
    "Return JSON: summary (2 sentences), nextSteps (string[] max 4). Honest fit analysis for Ali Slaimia.",
    `MATCH ${JSON.stringify(match)}\nJOB ${job.title} @ ${job.company} — ${clip(job.description, 2000)}`,
  );
  return {
    match,
    summary:
      cloud?.summary ||
      `Deterministic match ${match.score}/100. ${match.reasons[0] || "Review the listing details."}`,
    nextSteps:
      cloud?.nextSteps ||
      [
        "Skim requirements vs SkyPulse / GOLRI proof points",
        "Generate an Apply Pack and customize the cover letter",
        "Confirm visa/relocation on the careers page",
      ],
    model: cloud ? "openai" : "roleradar-local-v1",
  };
}
