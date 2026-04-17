import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert at parsing Olympic weightlifting / strength training programs.

You receive raw text (usually copy-pasted from an Excel spreadsheet or typed manually) that describes a multi-week training program.

Your job is to extract structured data from this text and return it using the provided tool.

Key rules:
- Identify the program name from context (filename, title row, or infer from content).
- Identify the total number of weeks.
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

For each training day/session, also extract and return scheduling priority metadata:

- priority: classify as one of: "primary" | "secondary" | "supplemental"
  - primary = competition lifts (snatch, clean & jerk) OR heavy main strength (squat, deadlift)
  - secondary = second strength pillar, pressing, supporting compound work
  - supplemental = volume days, accessory-only days, deload days, pulls-only days

- droppable: true | false
  - true ONLY if priority = "supplemental"
  - false for primary and secondary

- focus_label: short string (max 6 words) describing the day's main purpose
  - examples: "Back Squat heavy", "Competition lift - Snatch", "Volume + Accessories"

- drop_reason: one sentence explaining what is lost if this session is skipped
  - REQUIRED if droppable = true; otherwise return null

For REST days: priority = "supplemental", droppable = true, focus_label = "Rest", drop_reason = null.

After parsing all sessions, also return at the PROGRAM level:

- description: 3-5 sentences. What this program prioritizes, how it is structured, and what the athlete should expect. Tone: clear, direct, no fluff. Written as if the coach is briefing the athlete.

- phase_summary: array of phase objects. Detect phases from week labels, block names, or load progression patterns (e.g. accumulation -> intensification -> peaking -> deload). Each object has shape:
  {
    "weeks": "1-4",   // week range as a string, inclusive
    "label": "Accumulation",  // short phase name (e.g. "Accumulation", "Wave Loading", "Peak Strength", "Deload")
    "summary": "1-2 sentences describing what changes in this phase and why"
  }
  If you cannot detect distinct phases, return a single phase covering all weeks.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText, chunkIndex, totalChunks } = await req.json();
    if (!rawText || typeof rawText !== "string") {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isChunked = typeof totalChunks === "number" && totalChunks > 1;
    const isFirstChunk = !isChunked || chunkIndex === 0;

    // For non-first chunks, instruct the model to skip program-level work to save CPU.
    const chunkInstruction = isChunked
      ? isFirstChunk
        ? `\n\nThis is chunk 1 of ${totalChunks}. Parse the sessions in this chunk AND produce program-level fields (name, description, phase_summary). Use the visible weeks here plus typical structure to infer phases for the whole program.`
        : `\n\nThis is chunk ${chunkIndex + 1} of ${totalChunks}. Parse the sessions in this chunk ONLY. For program-level fields, return name="(chunk)", description="", phase_summary=[]. Do NOT try to summarize the whole program.`
      : "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + chunkInstruction },
            {
              role: "user",
              content: `Parse this training program:\n\n${rawText}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_parsed_program",
                description:
                  "Return the fully parsed training program as structured data.",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Program name",
                    },
                    description: {
                      type: "string",
                      description: "3-5 sentence coach-style program overview for the athlete",
                    },
                    phase_summary: {
                      type: "array",
                      description: "Phase-by-phase breakdown of the program",
                      items: {
                        type: "object",
                        properties: {
                          weeks: { type: "string", description: "Week range, e.g. '1-4'" },
                          label: { type: "string", description: "Short phase name" },
                          summary: { type: "string", description: "1-2 sentences about this phase" },
                        },
                        required: ["weeks", "label", "summary"],
                        additionalProperties: false,
                      },
                    },
                    weeks: {
                      type: "integer",
                      description: "Total number of weeks",
                    },
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
                            description: "Scheduling priority of the session",
                          },
                          droppable: {
                            type: "boolean",
                            description: "True only if priority is supplemental",
                          },
                          focus_label: {
                            type: "string",
                            description: "Short (max 6 words) main purpose of the day",
                          },
                          drop_reason: {
                            type: ["string", "null"],
                            description: "What is lost if skipped; required when droppable=true",
                          },
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
                        required: [
                          "week_number",
                          "day_of_week",
                          "session_type",
                          "exercises",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["name", "weeks", "sessions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_parsed_program" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call returned from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ program: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-program error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
