import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://fantasy.premierleague.com/api/bootstrap-static/"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bootstrap static data");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching bootstrap static:", error);
    return NextResponse.json(
      { error: "Failed to fetch bootstrap static data" },
      { status: 500 }
    );
  }
}
