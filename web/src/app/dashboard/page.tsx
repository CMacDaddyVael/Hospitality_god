import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardIndexPage({
  searchParams,
}: {
  searchParams: { property?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If a property is specified in the URL, use that
  if (searchParams.property) {
    redirect(`/dashboard/${searchParams.property}`);
  }

  // Otherwise, redirect to the first property
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (properties && properties.length > 0) {
    redirect(`/dashboard/${properties[0].id}`);
  }

  // No properties — show empty state
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-6">🏡</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        Your agent is ready to work
      </h2>
      <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
        Connect your first property and your AI CMO starts working immediately —
        optimizing your listing, responding to reviews, and scheduling social
        content on autopilot.
      </p>
      <a
        href="/onboarding"
        className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
      >
        <span>Connect Your First Property</span>
        <span>→</span>
      </a>
      <p className="text-sm text-gray-400 mt-4">
        Takes about 3 minutes. No credit card required to start.
      </p>
    </div>
  );
}
