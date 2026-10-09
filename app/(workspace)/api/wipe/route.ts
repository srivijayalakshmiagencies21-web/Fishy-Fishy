import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete all journeys for this user. RLS will ensure they only delete their own.
  const { data, error } = await supabase
    .from("journeys")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: data.length });
}
