"use server";

import { revalidatePath } from "next/cache";

export async function refreshMarkets() {
  const projectId = process.env.SUPABASE_PROJECT_ID!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `https://${projectId}.functions.supabase.co/market-refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    console.error("market-refresh failed:", await res.text());
  }

  revalidatePath("/finance");
  revalidatePath("/");
}
