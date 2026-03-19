import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all properties for the user
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, platform, location")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <DashboardShell user={user} properties={properties ?? []}>
      {children}
    </DashboardShell>
  );
}
