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
- If a day is marked as rest or off, still include it as a session with session_type "REST" and empty exercises.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== "string") {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
            { role: "system", content: SYSTEM_PROMPT },
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
                      description: "Brief program description",
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
