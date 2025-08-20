import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET(request: NextRequest) {
  try {
    // Extract 'teamId' param from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    const teamId = segments[segments.length - 2]; // teamId is before 'history'

    const response = await fetchFPLAPI(
      `https://fantasy.premierleague.com/api/entry/${teamId}/history/`
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching team history:", error);

    // More specific error handling
    if (error.message?.includes("404")) {
      return NextResponse.json(
        { error: "Team history not found" },
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
          error: `Failed to fetch team history: ${
            error.message || "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  }
}
