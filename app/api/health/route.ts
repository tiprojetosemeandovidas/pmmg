import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function GET() {
  return NextResponse.json({
    status: "ok",
    runtime: "nextjs",
    databaseConfigured: Boolean(getSupabaseConfig()),
  });
}
