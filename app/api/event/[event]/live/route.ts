import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Extract 'event' param from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    const event = segments[segments.length - 2]; // event is before 'live'

    const response = await fetch(
      `https://fantasy.premierleague.com/api/event/${event}/live/`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch live gameweek data");
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching live gameweek data:", error);
    return NextResponse.json(
      { error: "Failed to fetch live gameweek data" },
      { status: 500 }
    );
  }
}
