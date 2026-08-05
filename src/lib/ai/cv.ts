import { PROFILE } from "@/lib/profile";
import type { CandidateProfile } from "@/lib/jobs/types";
import { clip, redactSecrets } from "@/lib/security/sanitize";

const SKILL_CATALOG = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Angular",
  "Vue",
  "Node.js",
  "Express",
  "NestJS",
  "Spring Boot",
  "Java",
  "Python",
  "Django",
  "FastAPI",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "CI/CD",
  "Git",
  "GraphQL",
  "REST",
  "Tailwind",
  "Machine Learning",
  "NLP",
  "TensorFlow",
  "PyTorch",
  "Zod",
  "Prisma",
  "Supabase",
  "Firebase",
  "React Native",
  "Flutter",
  "Go",
  "Rust",
  "PHP",
  "Symfony",
  "Laravel",
  "C#",
  ".NET",
  "Kafka",
  "RabbitMQ",
  "Terraform",
  "Linux",
  "Agile",
  "Scrum",
  "Leaflet",
  "OpenAI",
  "LangChain",
];

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function extractSkills(text: string) {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_CATALOG) {
    const s = skill.toLowerCase();
    if (s === "go") {
      if (/\bgo\b|\bgolang\b/i.test(text)) found.push(skill);
      continue;
    }
    if (s === "c#") {
      if (/c#|\.net/i.test(text)) found.push(skill);
      continue;
    }
    if (
      lower.includes(s) ||
      (s === "next.js" && lower.includes("nextjs")) ||
      (s === "node.js" && (lower.includes("nodejs") || lower.includes("node js")))
    ) {
      found.push(skill);
    }
  }
  return [...new Set(found)].slice(0, 30);
}

function extractName(text: string) {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 60) continue;
    if (/@|http|curriculum|resume|cv\b|profile|skills|experience/i.test(line)) continue;
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){0,3}$/.test(line)) return line;
    if (/^[A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z][A-Za-z'.-]+){1,3}$/.test(line)) return line;
  }
  return PROFILE.name;
}

function localParseCv(text: string): CandidateProfile & { email: string | null; confidence: string } {
  const skills = extractSkills(text);
  const email = extractEmail(text);
  const name = extractName(text);
  const tunisia = /tunisia|tunis|bizerte|sfax|sousse/i.test(text);
  const europe = /europe|reloc|visa|germany|france|netherlands|remote/i.test(text);
  const titleMatch = text.match(
    /(?:full[-\s]?stack|software|frontend|backend|devops|data)\s+(?:engineer|developer|intern)/i,
  );
  const highlights = text
    .split(/\n/)
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter((l) => l.length > 40 && l.length < 180)
    .filter((l) => /built|developed|led|shipped|designed|implemented|created/i.test(l))
    .slice(0, 4);

  return {
    name,
    title: titleMatch?.[0]
      ? titleMatch[0].replace(/\b\w/g, (c) => c.toUpperCase())
      : PROFILE.title,
    location: tunisia ? "Tunisia" : PROFILE.location,
    target: europe
      ? "Roles in Europe (remote or relocate) and Tunisia"
      : PROFILE.target,
    skills: skills.length ? skills : PROFILE.skills.slice(0, 8),
    highlights: highlights.length ? highlights : PROFILE.highlights.slice(0, 3),
    projects: PROFILE.projects,
    languages: [
      ...( /english/i.test(text) ? ["English"] : []),
      ...( /french|français/i.test(text) ? ["French"] : []),
      ...( /arabic|arabe/i.test(text) ? ["Arabic"] : []),
    ].length
      ? [
          ...new Set([
            ...(/english/i.test(text) ? ["English"] : []),
            ...(/french|français/i.test(text) ? ["French"] : []),
            ...(/arabic|arabe/i.test(text) ? ["Arabic"] : []),
          ]),
        ]
      : PROFILE.languages,
    email,
    confidence: skills.length >= 5 ? "medium-high (local parser)" : "medium (local parser)",
  };
}

async function openaiParse(text: string) {
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract a job-seeker profile from a CV. Return JSON: name, title, location, target, skills (string[]), highlights (string[] max 5), projects ({name, blurb, url?}[]), languages (string[]), email (string|null). No invented employers. If unsure, omit.",
          },
          { role: "user", content: redactSecrets(clip(text, 12000)) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return { parsed: JSON.parse(content) as CandidateProfile & { email?: string | null }, model: data.model || "openai" };
  } catch {
    return null;
  }
}

export async function parseCvText(text: string) {
  const local = localParseCv(text);
  const cloud = await openaiParse(text);
  if (!cloud?.parsed) {
    return { draft: local, model: "roleradar-cv-local-v1", rawChars: text.length };
  }
  const p = cloud.parsed;
  return {
    draft: {
      name: p.name || local.name,
      title: p.title || local.title,
      location: p.location || local.location,
      target: p.target || local.target,
      skills: Array.isArray(p.skills) && p.skills.length ? p.skills.slice(0, 30) : local.skills,
      highlights:
        Array.isArray(p.highlights) && p.highlights.length
          ? p.highlights.slice(0, 5)
          : local.highlights,
      projects:
        Array.isArray(p.projects) && p.projects.length ? p.projects.slice(0, 6) : local.projects,
      languages:
        Array.isArray(p.languages) && p.languages.length
          ? p.languages.slice(0, 6)
          : local.languages,
      email: p.email ?? local.email,
      confidence: "high (OpenAI + local merge)",
    },
    model: cloud.model,
    rawChars: text.length,
  };
}

export async function extractTextFromUpload(file: {
  name: string;
  type: string;
  buffer: Buffer;
}) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
    return file.buffer.toString("utf8");
  }
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: file.buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || "";
  }
  throw new Error("Supported CV formats: PDF, TXT, MD");
}
