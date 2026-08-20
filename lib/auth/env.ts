export function isNeonAuthConfigured(): boolean {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim() ?? "";
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim() ?? "";
  return Boolean(baseUrl) && secret.length >= 32;
}
