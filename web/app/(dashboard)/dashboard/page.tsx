import { createServerClient } from "@/lib/supabase/server";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user's properties count
  const { count: propertiesCount } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Here&apos;s what&apos;s happening with your properties
        </p>
      </div>

      <DashboardOverview
        propertiesCount={propertiesCount ?? 0}
        userId={user!.id}
      />
    </div>
  );
}
