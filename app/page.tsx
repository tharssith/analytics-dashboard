import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const qaConfigured = Boolean(
    process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim(),
  );
  return <Dashboard qaConfigured={qaConfigured} />;
}
