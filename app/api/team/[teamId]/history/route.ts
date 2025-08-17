import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params;

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
