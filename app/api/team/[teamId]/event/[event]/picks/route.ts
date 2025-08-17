import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Extract 'teamId' and 'event' params from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    // /api/team/[teamId]/event/[event]/picks
    const teamId = segments[3]; // teamId is at index 3
    const event = segments[5];   // event is at index 5

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
