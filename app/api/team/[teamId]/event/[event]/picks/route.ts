import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET(request: NextRequest) {
  try {
    // Extract 'teamId' and 'event' params from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    // /api/team/[teamId]/event/[event]/picks
    const teamId = segments[3]; // teamId is at index 3
    const event = segments[5]; // event is at index 5

    const response = await fetchFPLAPI(
      `https://fantasy.premierleague.com/api/entry/${teamId}/event/${event}/picks/`
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching team picks:", error);

    // More specific error handling
    if (error.message?.includes("404")) {
      return NextResponse.json(
        { error: "Team picks not found" },
        { status: 404 }
      );
    } else if (error.message?.includes("403")) {
      return NextResponse.json(
        { error: "Access denied to FPL API" },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        {
          error: `Failed to fetch team picks: ${
            error.message || "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  }
}
