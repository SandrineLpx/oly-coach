import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SESSIONS_SYSTEM_PROMPT = `You are an expert at parsing Olympic weightlifting / strength training programs.

You receive raw text (usually copy-pasted from an Excel spreadsheet or typed manually) that describes a multi-week training program.

Your job is to extract structured SESSION data from this text and return it using the provided tool.

Key rules:
- Identify the program name from context (filename, title row, or infer from content).
- For each training session, determine: week_number (1-based), day_of_week (0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat), session_type (one of: T, S, H, T2, REST — T=technique, S=strength, H=heavy, T2=technical-strength hybrid).
- If you can't determine the session_type, default to "T".
- Session name can include the phase name or day label from the program.
- For each exercise in a session, extract:
  - name: the exercise name exactly as written
  - sets: number of sets (integer or null)
  - reps: rep scheme as a string (e.g. "3", "2+1", "4x2, 2x1") — preserve original notation
  - percent_of_max: single number if a clear percentage is given (e.g. 80 for "80%"), null otherwise
  - notes: any additional info — intensity ranges ("80-85%"), qualitative cues ("Challenging with good form"), tempo, rest periods, or anything that doesn't fit cleanly into sets/reps/percent
  - order_index: 0-based order within the session
- Preserve the coach's original wording in notes when intensity can't be reduced to a single number.
- If a day is marked as rest or off, still include it as a session with session_type "REST" and empty exercises.

For each training day/session, also extract scheduling priority metadata:

- priority: "primary" | "secondary" | "supplemental"
  - primary = competition lifts (snatch, clean & jerk) OR heavy main strength (squat, deadlift)
  - secondary = second strength pillar, pressing, supporting compound work
  - supplemental = volume days, accessory-only days, deload days, pulls-only days

- droppable: true ONLY if priority = "supplemental", else false

- focus_label: short string (max 6 words) describing the day's main purpose

- drop_reason: one sentence explaining what is lost if skipped — REQUIRED if droppable=true, else null

For REST days: priority="supplemental", droppable=true, focus_label="Rest", drop_reason=null.

Do NOT produce description or phase_summary in this mode — that comes from a separate global pass.`;

const GLOBAL_SYSTEM_PROMPT = `You are an expert Olympic weightlifting / strength coach reviewing a complete multi-week training program.

You receive the FULL raw text of the program (headers, all weeks, notes — copy-pasted from Excel). Your job is to produce a global, holistic understanding of the program. Do NOT extract individual sessions or exercises.

Return:

- name: the program's name (from a title, filename, or inferred from the content).

- total_program_weeks: the actual total number of weeks in the WHOLE program (count distinct week labels in the text).

- description: 4-6 sentences. Cover:
  - The program's overall goal (peaking for competition? hypertrophy block? GPP?).
  - How it is structured across the full N weeks (e.g. "26 weeks split into accumulation, intensification, peaking, and deload phases").
  - The athlete archetype it suits (e.g. intermediate weightlifter, advanced powerlifter).
  - What the athlete should expect in terms of intensity progression and key milestones.
  Tone: clear, direct, coach-briefing-the-athlete. No fluff.

- phase_summary: array of phase objects covering ALL weeks of the program. Detect phases from week labels, block names, or load progression patterns. Each object:
  {
    "weeks": "1-4",      // inclusive range from the ORIGINAL program numbering
    "label": "Accumulation",
    "summary": "1-2 sentences describing what changes in this phase and why"
  }
  If you cannot detect distinct phases, return a single phase covering all weeks.`;

const SESSIONS_TOOL = {
  type: "function",
  function: {
    name: "return_parsed_sessions",
    description: "Return the parsed training sessions for this chunk.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Program name" },
        weeks: { type: "integer", description: "Highest week_number found in this chunk" },
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              week_number: { type: "integer" },
              day_of_week: { type: "integer" },
              session_type: { type: "string" },
              name: { type: "string" },
              notes: { type: "string" },
              priority: {
                type: "string",
                enum: ["primary", "secondary", "supplemental"],
              },
              droppable: { type: "boolean" },
              focus_label: { type: "string" },
              drop_reason: { type: ["string", "null"] },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    sets: { type: "integer" },
                    reps: { type: "string" },
                    percent_of_max: { type: "number" },
                    notes: { type: "string" },
                    order_index: { type: "integer" },
                  },
                  required: ["name", "order_index"],
                  additionalProperties: false,
                },
              },
            },
            required: ["week_number", "day_of_week", "session_type", "exercises"],
            additionalProperties: false,
          },
        },
      },
      required: ["name", "weeks", "sessions"],
      additionalProperties: false,
    },
  },
};

const GLOBAL_TOOL = {
  type: "function",
  function: {
    name: "return_program_overview",
    description: "Return the global program overview without parsing individual sessions.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        total_program_weeks: { type: "integer" },
        description: { type: "string" },
        phase_summary: {
          type: "array",
          items: {
            type: "object",
            properties: {
              weeks: { type: "string" },
              label: { type: "string" },
              summary: { type: "string" },
            },
            required: ["weeks", "label", "summary"],
            additionalProperties: false,
          },
        },
      },
      required: ["name", "total_program_weeks", "description", "phase_summary"],
      additionalProperties: false,
    },
  },
};

async function callGateway(systemPrompt: string, rawText: string, tool: any, toolName: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!response.ok) {
    const t = await response.text().catch(() => "");
    const err: any = new Error(`AI gateway error: ${response.status}`);
    err.status = response.status;
    err.body = t;
    throw err;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call returned from AI");
  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      rawText,
      mode = "sessions", // "sessions" | "global"
      chunkIndex,
      totalChunks,
    } = body;

    if (!rawText || typeof rawText !== "string") {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "global") {
      // Single pass over the FULL program text — produces description + phase_summary
      // covering every week the program contains, regardless of which slice the
      // user is currently importing.
      const overview = await callGateway(
        GLOBAL_SYSTEM_PROMPT,
        `Review this full training program and return its global overview:\n\n${rawText}`,
        GLOBAL_TOOL,
        "return_program_overview",
      );
      return new Response(JSON.stringify({ overview }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode === "sessions" — parse just the sessions present in this chunk.
    const isChunked = typeof totalChunks === "number" && totalChunks > 1;
    const chunkInstruction = isChunked
      ? `\n\nThis is chunk ${(chunkIndex ?? 0) + 1} of ${totalChunks}. Parse the sessions in this chunk only.`
      : "";

    const program = await callGateway(
      SESSIONS_SYSTEM_PROMPT + chunkInstruction,
      `Parse the sessions in this training program slice:\n\n${rawText}`,
      SESSIONS_TOOL,
      "return_parsed_sessions",
    );

    return new Response(JSON.stringify({ program }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e?.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e?.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("parse-program error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
