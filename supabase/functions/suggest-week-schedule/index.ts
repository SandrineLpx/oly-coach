import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SessionInput {
  id: string;
  day_of_week: number;
  session_type: string;
  focus_label?: string | null;
  priority?: "primary" | "secondary" | "supplemental" | null;
  droppable?: boolean | null;
  name?: string | null;
  exercises?: Array<{
    name: string;
    sets?: number | null;
    reps?: string | null;
    percent_of_max?: number | null;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessions, available_days } = (await req.json()) as {
      sessions: SessionInput[];
      available_days: number[];
    };

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return new Response(
        JSON.stringify({ error: "sessions array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!Array.isArray(available_days) || available_days.length === 0) {
      return new Response(
        JSON.stringify({ error: "available_days array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dayLabels = available_days.map((d) => DAY_NAMES[d]).join(", ");
    const sessionsBlock = sessions
      .map((s) => {
        const exList =
          (s.exercises || [])
            .slice(0, 6)
            .map(
              (e) =>
                `      - ${e.name}${e.sets ? ` ${e.sets}x${e.reps ?? ""}` : ""}${
                  e.percent_of_max ? ` @${e.percent_of_max}%` : ""
                }`,
            )
            .join("\n") || "      (no exercises listed)";
        return `  - id: ${s.id}
    type: ${s.session_type}
    focus_label: ${s.focus_label ?? s.name ?? s.session_type}
    priority: ${s.priority ?? "primary"}
    droppable: ${s.droppable ? "true" : "false"}
    exercises:
${exList}`;
      })
      .join("\n");

    const userPrompt = `Sessions in this week:
${sessionsBlock}

The athlete has ${available_days.length} available training days this week: ${dayLabels}.

Rules:
1. Never drop primary sessions.
2. Drop supplemental first; only drop secondary if unavoidable.
3. If dropping a session, suggest 2-3 KEY exercises from it to rescue into other sessions.
4. Assign each kept session to exactly one of the available days. Distribute load across the week (avoid putting two heavy sessions back-to-back).
5. Use the day_of_week integer (0=Sun..6=Sat) in your "day" field.

Return ONLY via the propose_schedule tool.`;

    const tool = {
      type: "function",
      function: {
        name: "propose_schedule",
        description:
          "Propose a schedule for the week given available days, plus a list of dropped sessions with rescued exercises.",
        parameters: {
          type: "object",
          properties: {
            schedule: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "integer", description: "0=Sun..6=Sat" },
                  session_id: { type: "string" },
                  focus_label: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["day", "session_id", "focus_label", "notes"],
                additionalProperties: false,
              },
            },
            dropped: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  session_id: { type: "string" },
                  focus_label: { type: "string" },
                  reason: { type: "string" },
                  rescued_exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        sets: { type: "integer" },
                        reps: { type: "string" },
                        absorb_into_session_id: { type: "string" },
                      },
                      required: ["name", "sets", "reps", "absorb_into_session_id"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["session_id", "focus_label", "reason", "rescued_exercises"],
                additionalProperties: false,
              },
            },
          },
          required: ["schedule", "dropped"],
          additionalProperties: false,
        },
      },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an expert Olympic weightlifting coach. You compress a planned training week into fewer days when an athlete cannot train every scheduled day. Preserve primary sessions and never invent exercises.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "propose_schedule" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "AI returned no structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", toolCall.function.arguments);
      return new Response(JSON.stringify({ error: "AI output was not valid JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-week-schedule error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
