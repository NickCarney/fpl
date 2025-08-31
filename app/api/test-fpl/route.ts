import { NextRequest, NextResponse } from "next/server";
import { fetchFPLAPI } from "@/lib/fpl-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get("test") || "bootstrap";

  try {
    let testUrl = "";
    let description = "";

    switch (testType) {
      case "bootstrap":
        testUrl = "https://fantasy.premierleague.com/api/bootstrap-static/";
        description = "Bootstrap Static Data";
        break;
      case "team":
        const teamId = searchParams.get("teamId") || "1";
        testUrl = `https://fantasy.premierleague.com/api/entry/${teamId}/`;
        description = `Team ${teamId} Info`;
        break;
      default:
        return NextResponse.json(
          { error: "Invalid test type" },
          { status: 400 }
        );
    }

    //console.log(`Testing FPL API: ${description} - ${testUrl}`);

    const startTime = Date.now();
    const response = await fetchFPLAPI(testUrl);
    const endTime = Date.now();

    const data = await response.json();

    return NextResponse.json({
      success: true,
      test: description,
      url: testUrl,
      responseTime: `${endTime - startTime}ms`,
      dataReceived: !!data,
      sampleData:
        testType === "bootstrap"
          ? {
              totalPlayers: data.elements?.length || 0,
              totalTeams: data.teams?.length || 0,
              currentEvent:
                data.events?.find((e: any) => e.is_current)?.id || "None",
            }
          : {
              teamName: data.name || "Unknown",
              playerName:
                `${data.player_first_name || ""} ${
                  data.player_last_name || ""
                }`.trim() || "Unknown",
              overallPoints: data.summary_overall_points || 0,
            },
    });
  } catch (error: any) {
    console.error(`FPL API test failed:`, error);

    return NextResponse.json(
      {
        success: false,
        test: testType,
        error: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
