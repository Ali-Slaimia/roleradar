export type Job = {
  id: string;
  source: "remotive" | "remoteok" | "arbeitnow" | "jobicy" | "adzuna";
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  tags: string[];
  salary: string | null;
  remote: boolean;
  europeSignal: boolean;
  tunisiaFriendly: boolean;
  visaSignal: boolean;
  publishedAt: string | null;
};

export type CandidateProfile = {
  name: string;
  title: string;
  location: string;
  target: string;
  skills: string[];
  highlights: string[];
  projects: Array<{ name: string; blurb: string; url?: string }>;
  languages: string[];
};
