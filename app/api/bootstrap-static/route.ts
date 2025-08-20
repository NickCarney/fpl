import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET() {
  try {
    const response = await fetchFPLAPI(
      "https://fantasy.premierleague.com/api/bootstrap-static/"
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching bootstrap static:", error);

    // More specific error handling
    if (error.message?.includes("403")) {
      return NextResponse.json(
        { error: "Access denied to FPL API" },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        {
          error: `Failed to fetch bootstrap static data: ${
            error.message || "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  }
}
