const buckets = new Map<string, { count: number; reset: number }>();

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const row = buckets.get(key);
  if (!row || now > row.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true as const, remaining: limit - 1 };
  }
  if (row.count >= limit) return { ok: false as const, remaining: 0 };
  row.count += 1;
  return { ok: true as const, remaining: limit - row.count };
}
