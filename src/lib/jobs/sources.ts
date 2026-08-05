import type { Job } from "@/lib/jobs/types";
import { normalizeTags, signalsFromText, stripHtml } from "@/lib/jobs/normalize";

export async function fetchRemotive(): Promise<Job[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs?category=software-dev", {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Remotive ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      url: string;
      title: string;
      company_name: string;
      candidate_required_location?: string;
      description?: string;
      salary?: string;
      tags?: string[];
      publication_date?: string;
    }>;
  };
  return (data.jobs || []).map((j) => {
    const location = j.candidate_required_location || "Remote";
    const description = stripHtml(j.description || "");
    const tags = normalizeTags(j.tags);
    const s = signalsFromText(location, description, tags);
    return {
      id: `remotive-${j.id}`,
      source: "remotive" as const,
      title: j.title,
      company: j.company_name,
      location,
      url: j.url,
      description,
      tags,
      salary: j.salary || null,
      remote: true,
      europeSignal: s.europeSignal,
      tunisiaFriendly: s.tunisiaFriendly,
      visaSignal: s.visaSignal,
      publishedAt: j.publication_date || null,
    };
  });
}

export async function fetchRemoteOk(): Promise<Job[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "RoleRadar/1.0 (portfolio; Ali-Slaimia)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data
    .filter((row) => row && typeof row.id !== "undefined" && row.position)
    .map((row) => {
      const title = String(row.position);
      const company = String(row.company || "Unknown");
      const location = String(row.location || "Remote");
      const description = stripHtml(String(row.description || ""));
      const tags = normalizeTags(row.tags);
      const s = signalsFromText(location, description, tags);
      const url =
        typeof row.url === "string"
          ? row.url
          : `https://remoteok.com/l/${row.id}`;
      return {
        id: `remoteok-${row.id}`,
        source: "remoteok" as const,
        title,
        company,
        location,
        url,
        description,
        tags,
        salary:
          row.salary_min || row.salary_max
            ? `${row.salary_min || "?"}–${row.salary_max || "?"} ${row.currency || "USD"}`
            : null,
        remote: true,
        europeSignal: s.europeSignal,
        tunisiaFriendly: s.tunisiaFriendly,
        visaSignal: s.visaSignal,
        publishedAt: row.date ? String(row.date) : null,
      };
    });
}

export async function fetchArbeitnow(): Promise<Job[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{
      slug: string;
      url: string;
      title: string;
      company_name: string;
      location: string;
      description?: string;
      tags?: string[];
      remote?: boolean;
      created_at?: string;
    }>;
  };
  return (data.data || []).map((j) => {
    const description = stripHtml(j.description || "");
    const tags = normalizeTags(j.tags);
    const s = signalsFromText(j.location || "", description, tags);
    return {
      id: `arbeitnow-${j.slug}`,
      source: "arbeitnow" as const,
      title: j.title,
      company: j.company_name,
      location: j.location || "Europe",
      url: j.url,
      description,
      tags,
      salary: null,
      remote: !!j.remote,
      europeSignal: true, // Arbeitnow is EU-focused
      tunisiaFriendly: s.tunisiaFriendly || s.visaSignal,
      visaSignal: s.visaSignal,
      publishedAt: j.created_at || null,
    };
  });
}

export async function fetchJobicy(): Promise<Job[]> {
  const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&tag=typescript", {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Jobicy ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      url: string;
      jobTitle: string;
      companyName: string;
      jobGeo?: string;
      jobDescription?: string;
      jobSalary?: string;
      jobTags?: string[] | string;
      pubDate?: string;
    }>;
  };
  return (data.jobs || []).map((j) => {
    const location = j.jobGeo || "Remote";
    const description = stripHtml(j.jobDescription || "");
    const tags = normalizeTags(j.jobTags);
    const s = signalsFromText(location, description, tags);
    return {
      id: `jobicy-${j.id}`,
      source: "jobicy" as const,
      title: j.jobTitle,
      company: j.companyName,
      location,
      url: j.url,
      description,
      tags,
      salary: j.jobSalary || null,
      remote: true,
      europeSignal: s.europeSignal,
      tunisiaFriendly: s.tunisiaFriendly,
      visaSignal: s.visaSignal,
      publishedAt: j.pubDate || null,
    };
  });
}
