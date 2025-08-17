import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string; event: string } }
) {
  try {
    const { teamId, event } = params;

    const response = await fetch(
      `https://fantasy.premierleague.com/api/entry/${teamId}/event/${event}/picks/`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch team picks");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching team picks:", error);
    return NextResponse.json(
      { error: "Failed to fetch team picks" },
      { status: 500 }
    );
  }
}
