import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;

    const segments = url.pathname.split("/");
    // /api/team/[teamId]/picks
    const teamId = segments[3];

    if (!teamId || isNaN(Number(teamId))) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const response = await fetchFPLAPI(
      `https://fantasy.premierleague.com/api/entry/${teamId}/`
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching team info:", error);

    // More specific error handling
    if (error.message?.includes("404")) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    } else if (error.message?.includes("403")) {
      return NextResponse.json(
        { error: "Access denied to FPL API" },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        {
          error: `Failed to fetch team information: ${
            error.message || "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  }
}
