const INJECTION =
  /(ignore (all|previous|above) instructions|system prompt|you are now|jailbreak|<\s*script)/i;

export function looksLikePromptInjection(text: string) {
  return INJECTION.test(text);
}

export function redactSecrets(text: string) {
  return text
    .replace(/sk-[a-zA-Z0-9]{10,}/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [redacted]");
}

export function clip(text: string, max = 6000) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}
