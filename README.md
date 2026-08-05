# RoleRadar

**Tunisia → Europe job radar** with live listings, skill match scores, and AI apply packs — built for Ali Slaimia’s job search and CV.

**Not a toy seed app.** Jobs come from public APIs (Remotive, RemoteOK, Arbeitnow, Jobicy). Match scoring uses a real candidate profile. AI cover letters / interview prep use OpenAI when configured, otherwise a solid local fallback.

## Features

| Feature | What it proves |
| --- | --- |
| Live job board | Multi-source aggregation, caching, dedupe, filters (Europe / visa / TN-friendly) |
| Match score | Deterministic skills + geo/visa signals vs editable profile |
| AI apply pack | Elevator pitch, cover letter, CV bullets, outreach DM, risks |
| Interview prep | Role-specific questions + story bank from SkyPulse / GOLRI / WAFA |
| Security | Server-only fetches, rate limits, Zod validation, CSP headers, prompt-injection screen |

## Run

```bash
npm install
npm run dev
```

Open **http://localhost:3003**

```bash
cp .env.example .env
# optional: OPENAI_API_KEY for richer AI packs
```

## Customize your profile

Edit **`src/lib/profile.ts`** — skills, highlights, projects. Everything (match + AI) reads from there.

## CV blurb

See `CV_BLURB.md`.

## Attribution

Job data © respective boards (Remotive, RemoteOK, Arbeitnow, Jobicy). RoleRadar is an independent portfolio tool — not affiliated with employers.
