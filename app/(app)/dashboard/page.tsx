import { Dashboard } from "@/components/Dashboard";

export default function DashboardPage() {
  const qaConfigured = Boolean(
    process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim(),
  );
  return <Dashboard qaConfigured={qaConfigured} />;
}
