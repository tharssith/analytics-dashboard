export function getGrokApiKey(): string {
  return (
    process.env.GROK_API_KEY?.trim() ||
    process.env.XAI_API_KEY?.trim() ||
    ""
  );
}
