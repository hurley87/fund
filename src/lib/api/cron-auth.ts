import { env } from "@/lib/config/env";

export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("cron_secret");
  const expected = env.cronSecret;
  if (authHeader === `Bearer ${expected}`) return true;
  if (querySecret === expected) return true;
  return false;
}
