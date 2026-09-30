import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET(request: NextRequest) {
  try {
    // Extract 'playerId' param from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    const playerId = segments[segments.length - 2]; // playerId is before 'gameweeks'

    if (!playerId || isNaN(Number(playerId))) {
      return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
    }

    const response = await fetchFPLAPI(
      `https://fantasy.premierleague.com/api/element-summary/${playerId}/`
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching player gameweek data:", error);

    if (error.message?.includes("404")) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    } else if (error.message?.includes("403")) {
      return NextResponse.json(
        { error: "Access denied to FPL API" },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        {
          error: `Failed to fetch player gameweek data: ${
            error.message || "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  }
}
