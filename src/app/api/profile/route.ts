import { PROFILE } from "@/lib/profile";
import { json } from "@/lib/security/headers";

export async function GET() {
  return json({
    profile: PROFILE,
    note: "Edit src/lib/profile.ts to tune match scoring and AI apply packs.",
  });
}
