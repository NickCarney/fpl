import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";

    const response = await fetch(
      `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch league standings");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching league standings:", error);
    return NextResponse.json(
      { error: "Failed to fetch league standings" },
      { status: 500 }
    );
  }
}
