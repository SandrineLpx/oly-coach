import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Classify Strava activity types per TrainSmart rules
type ActivityClass = "hard_cardio" | "easy_cardio" | "gym" | "yoga" | "walk" | "ignored";

function classifyActivity(type: string, durationSeconds: number): ActivityClass {
  const t = type.toLowerCase();
  // Hard cardio: interference signal
  if (["run", "mtb", "mountainbikeride", "ski", "backcountryski", "nordicski", "snowboard"].some(k => t.includes(k))) {
    return "hard_cardio";
  }
  // Ride: hard if > 90 min, otherwise easy
  if (t === "ride" || t === "virtualride" || t === "ebikeride") {
    return durationSeconds > 90 * 60 ? "hard_cardio" : "easy_cardio";
  }
  // Gym
  if (t === "weighttraining" || t === "crossfit") {
    return "gym";
  }
  // Yoga
  if (t === "yoga") {
    return "yoga";
  }
  // Walks and hikes - ignored
  if (t === "walk" || t === "hike") {
    return "walk";
  }
  return "ignored";
}

async function refreshTokenIfNeeded(
  supabase: any,
  userId: string,
  tokenRow: any,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenRow.expires_at > now + 60) {
    return tokenRow.access_token;
  }

  // Refresh
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Token refresh failed");

  const tokens = await res.json();
  await supabase.from("strava_tokens").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
  }).eq("user_id", userId);

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Strava not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get stored tokens
    const { data: tokenRow } = await supabase
      .from("strava_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ status: "not_connected", activities: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await refreshTokenIfNeeded(supabase, user.id, tokenRow, clientId, clientSecret);

    // Fetch recent activities (last 7 days)
    const { days_back = 7 } = await req.json().catch(() => ({}));
    const after = Math.floor(Date.now() / 1000) - days_back * 24 * 60 * 60;

    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!activitiesRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch activities" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawActivities = await activitiesRes.json();

    const activities = rawActivities.map((a: any) => ({
      id: a.id.toString(),
      name: a.name,
      type: a.type,
      date: a.start_date_local?.split("T")[0] || a.start_date?.split("T")[0],
      duration_minutes: Math.round((a.moving_time || a.elapsed_time || 0) / 60),
      distance_km: a.distance ? Math.round(a.distance / 100) / 10 : null,
      classified_as: classifyActivity(a.type, a.moving_time || 0),
    }));

    return new Response(JSON.stringify({ status: "connected", activities }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
