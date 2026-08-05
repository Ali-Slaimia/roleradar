import { z } from "zod";
import { extractTextFromUpload, parseCvText } from "@/lib/ai/cv";
import { json } from "@/lib/security/headers";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { looksLikePromptInjection } from "@/lib/security/sanitize";

export const runtime = "nodejs";

const textSchema = z.object({
  text: z.string().trim().min(40).max(80_000),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`cv:${ip}`, 8);
  if (!rl.ok) return json({ error: "CV scan rate limit — wait a minute" }, 429);

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pasted = String(form.get("text") || "");
      let text = pasted;
      if (file && typeof file !== "string") {
        const blob = file as File;
        if (blob.size > 4_000_000) return json({ error: "CV too large (max 4MB)" }, 400);
        const buffer = Buffer.from(await blob.arrayBuffer());
        text = await extractTextFromUpload({
          name: blob.name || "cv.pdf",
          type: blob.type || "",
          buffer,
        });
      }
      text = text.trim();
      if (text.length < 40) return json({ error: "Could not read enough text from CV" }, 400);
      if (looksLikePromptInjection(text.slice(0, 2000))) {
        return json({ error: "Rejected input" }, 400);
      }
      const result = await parseCvText(text);
      return json({
        ...result,
        note: "Review and confirm the extracted profile before we re-rank compatible jobs.",
      });
    }

    const body = await req.json();
    const parsed = textSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Provide CV text (40+ chars) or upload a file" }, 400);
    if (looksLikePromptInjection(parsed.data.text.slice(0, 2000))) {
      return json({ error: "Rejected input" }, 400);
    }
    const result = await parseCvText(parsed.data.text);
    return json({
      ...result,
      note: "Review and confirm the extracted profile before we re-rank compatible jobs.",
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "CV parse failed" },
      400,
    );
  }
}
