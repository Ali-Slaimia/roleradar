import type { Job } from "@/lib/jobs/types";

const EUROPE_HINT =
  /\b(europe|eu|emea|germany|france|netherlands|amsterdam|berlin|paris|london|uk|ireland|dublin|spain|madrid|barcelona|portugal|lisbon|sweden|stockholm|norway|oslo|denmark|copenhagen|finland|helsinki|belgium|brussels|austria|vienna|switzerland|zurich|italy|milan|rome|poland|warsaw|czech|prague|romania|bulgaria|greece|estonia|latvia|lithuania|remote[- ]?eu|eu[- ]?remote)\b/i;

const TUNISIA_FRIENDLY =
  /\b(tunisia|tunis|north africa|mena|africa|worldwide|anywhere|global|utc[+\-]?[01]|timezone.?flexible|open to relocate|relocation|visa|sponsor)\b/i;

const VISA =
  /\b(visa\s*sponsor|sponsorship|relocation\s*support|work\s*permit|eu\s*passport\s*not\s*required|open\s*to\s*candidates\s*outside)\b/i;

const TECH =
  /\b(software|engineer|developer|fullstack|full[- ]stack|frontend|backend|react|next\.?js|typescript|javascript|node|java|spring|python|devops|sre|platform|mobile|android|ios)\b/i;

export function signalsFromText(location: string, description: string, tags: string[]) {
  const blob = `${location} ${description} ${tags.join(" ")}`;
  return {
    europeSignal: EUROPE_HINT.test(blob) || /remote/i.test(location),
    tunisiaFriendly: TUNISIA_FRIENDLY.test(blob) || /worldwide|anywhere|global/i.test(location),
    visaSignal: VISA.test(blob),
    isTech: TECH.test(blob),
  };
}

export function normalizeTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 16);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,|]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 16);
  }
  return [];
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const j of jobs) {
    const key = `${j.company}|${j.title}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}
