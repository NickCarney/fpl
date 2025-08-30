import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET(request: NextRequest) {
  try {
    // Extract 'teamId' param from the URL
    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    // /api/team/[teamId]/transfers
    const teamId = segments[3]; // teamId is at index 3

    const response = await fetchFPLAPI(
      `https://fantasy.premierleague.com/api/entry/${teamId}/transfers/`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Team transfers not found" },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { error: "Access denied to FPL API" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch team transfers: ${response.statusText}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Map to expected output format
    const transfers = Array.isArray(data)
      ? data.map((t) => ({
          element_in: t.element_in,
          element_out: t.element_out,
          event: t.event,
          time: t.time,
          element_in_cost: t.element_in_cost,
          element_out_cost: t.element_out_cost,
        }))
      : [];

    return NextResponse.json(transfers);
  } catch (error: any) {
    console.error("Error fetching team transfers:", error);

    return NextResponse.json(
      {
        error: `Failed to fetch team transfers: ${
          error.message || "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
