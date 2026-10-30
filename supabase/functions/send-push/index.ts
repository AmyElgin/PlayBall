// Sends new notifications to phones through Expo's push service (free),
// which delivers to Apple (APNs) and Google (FCM).
//
// Called by the database trigger in 20261030000004_push.sql with
// { ids: number[] }. Deploy without JWT checks; the shared secret protects it:
//   supabase functions deploy send-push --no-verify-jwt
//   supabase secrets set PUSH_WEBHOOK_SECRET=<same value as private.settings>
// Optional: EXPO_ACCESS_TOKEN if "enhanced push security" is on in Expo.

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo's maximum per request

type Note = { id: number; user_id: string; title: string; body: string; kind: string; data: Record<string, unknown> };
type Token = { token: string; user_id: string };

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { ids } = await req.json() as { ids?: number[] };
  if (!ids?.length) return Response.json({ sent: 0 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: notes, error } = await db
    .from("notifications")
    .select("id, user_id, title, body, kind, data")
    .in("id", ids);
  if (error) return new Response(error.message, { status: 500 });

  const userIds = [...new Set((notes as Note[]).map((n) => n.user_id))];
  const tokens: Token[] = [];
  for (let i = 0; i < userIds.length; i += 500) {
    const { data, error: tokenError } = await db
      .from("push_tokens")
      .select("token, user_id")
      .in("user_id", userIds.slice(i, i + 500));
    if (tokenError) return new Response(tokenError.message, { status: 500 });
    tokens.push(...(data as Token[]));
  }

  const byUser = new Map<string, string[]>();
  for (const t of tokens) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);

  const messages = (notes as Note[]).flatMap((n) =>
    (byUser.get(n.user_id) ?? []).map((to) => ({
      to,
      title: n.title,
      body: n.body,
      sound: "default",
      priority: "high",
      data: { ...n.data, kind: n.kind, notification_id: n.id },
    }))
  );

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

  // Phones that uninstalled the app: forget their tokens.
  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += CHUNK) {
    const batch = messages.slice(i, i + CHUNK);
    const res = await fetch(EXPO_URL, { method: "POST", headers, body: JSON.stringify(batch) });
    if (!res.ok) {
      console.error("Expo push failed", res.status, await res.text());
      continue;
    }
    const { data: tickets } = await res.json() as { data: { status: string; details?: { error?: string } }[] };
    tickets.forEach((t, j) => {
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") deadTokens.push(batch[j].to);
    });
  }
  if (deadTokens.length) await db.from("push_tokens").delete().in("token", deadTokens);

  return Response.json({ sent: messages.length, removed: deadTokens.length });
});
