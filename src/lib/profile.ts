import type { CandidateProfile } from "@/lib/jobs/types";

/** Editable candidate profile used for match scoring + AI apply packs. */
export const PROFILE: CandidateProfile = {
  name: "Ali Slaimia",
  title: "Full-Stack Software Engineer",
  location: "Bizerte, Tunisia",
  target: "Junior/mid full-stack roles in Europe (remote or relocate) and Tunisia",
  skills: [
    "TypeScript",
    "JavaScript",
    "React",
    "Next.js",
    "Angular",
    "Node.js",
    "Spring Boot",
    "Python",
    "PostgreSQL",
    "MongoDB",
    "Docker",
    "AWS",
    "CI/CD",
    "Git",
    "Machine Learning",
    "NLP",
    "Zod",
    "API security",
    "Leaflet",
  ],
  highlights: [
    "Built SkyPulse — live ADS-B aviation intelligence with delay proxies, hub boards, and AI briefs",
    "Shipped GOLRI comedy platform features in Paris (Visolus) with +25% recommendation accuracy",
    "Delivered WAFA BATIMENT marketing site for a Bizerte construction company (Netlify)",
    "ESPRIT Software Architecture graduate — fluent English & French",
  ],
  projects: [
    {
      name: "SkyPulse",
      blurb: "Live aviation map, Tunisia delay board, AI sky briefs, secured OpenSky proxies",
      url: "https://sky-pulse-ali.netlify.app",
    },
    {
      name: "GOLRI",
      blurb: "AI-powered show discovery for France humor ecosystem",
      url: "https://golri.app",
    },
    {
      name: "WAFA BATIMENT",
      blurb: "Next.js marketing site for Société El Wafa de Bâtiment",
      url: "https://el-wafa.netlify.app",
    },
  ],
  languages: ["English", "French", "Arabic"],
};
