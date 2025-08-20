import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Fetching fixtures from FPL API...");

    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      "https://fantasy.premierleague.com/api/fixtures/",
      {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.length} fixtures`);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching fixtures:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout - FPL API took too long to respond" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch fixtures",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
