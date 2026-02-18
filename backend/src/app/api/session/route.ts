import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "API key not configured. Please set OPENAI_API_KEY in your .env file." },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-realtime-preview",
        }),
      }
    );

    const raw = await response.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error("Error in /session: OpenAI response was not JSON", raw.slice(0, 200));
      return NextResponse.json(
        { error: "Realtime session provider returned invalid response." },
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: (data as { error?: { message?: string } })?.error?.message ?? "Failed to create session" },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return NextResponse.json(data, { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
