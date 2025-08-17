import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Extract 'teamId' param from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    const teamId = segments[segments.length - 2]; // teamId is before 'history'

    const response = await fetch(
      `https://fantasy.premierleague.com/api/entry/${teamId}/history/`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch team history");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching team history:", error);
    return NextResponse.json(
      { error: "Failed to fetch team history" },
      { status: 500 }
    );
  }
}
