import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://fantasy.premierleague.com/api/fixtures/"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch fixtures");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching fixtures:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixtures" },
      { status: 500 }
    );
  }
}
