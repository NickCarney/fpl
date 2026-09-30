import { NextRequest, NextResponse } from "next/server";
import { getGamesPlayed, getMinValidMinutes } from "@/lib/player-eligibility";
import { getAvailability } from "@/lib/player-availability";

interface RAGData {
  positionAverages: {
    [position: string]: {
      averagePoints: number;
      topPerformers: string[];
      priceRanges: {
        budget: number;
        mid: number;
        premium: number;
      };
    };
  };
  transferTrends: {
    mostTransferredIn: string[];
    mostTransferredOut: string[];
    risingPrices: string[];
    fallingPrices: string[];
  };
  formLeaders: { player: string; form: number }[];
  xgLeaders: { player: string; xG: number; xA: number }[];
  availabilityConcerns: {
    player: string;
    status: string;
    chanceOfPlaying: number | null;
    news: string;
  }[];
  nextGameweekFixtures: any[];
}

function calculatePositionAverages(
  elements: any[]
): RAGData["positionAverages"] {
  const positions = {
    Goalkeeper: { id: 1, players: [] as any[] },
    Defender: { id: 2, players: [] as any[] },
    Midfielder: { id: 3, players: [] as any[] },
    Forward: { id: 4, players: [] as any[] },
  };

  elements.forEach((player) => {
    const positionName = Object.keys(positions).find(
      (pos) =>
        positions[pos as keyof typeof positions].id === player.element_type
    );
    if (positionName) {
      positions[positionName as keyof typeof positions].players.push(player);
    }
  });

  const result: RAGData["positionAverages"] = {};

  Object.entries(positions).forEach(([positionName, data]) => {
    const players = data.players;
    if (players.length === 0) return;

    const averagePoints =
      players.reduce((sum, p) => sum + p.total_points, 0) / players.length;

    const sortedByPoints = [...players].sort(
      (a, b) => b.total_points - a.total_points
    );
    const topPerformers = sortedByPoints
      .slice(0, Math.ceil(players.length * 0.1))
      .map((p) => p.web_name);

    const sortedByPrice = [...players].sort((a, b) => a.now_cost - b.now_cost);
    const priceRanges = {
      budget: sortedByPrice[Math.floor(players.length * 0.33)]?.now_cost / 10 || 0,
      mid: sortedByPrice[Math.floor(players.length * 0.66)]?.now_cost / 10 || 0,
      premium: sortedByPrice[Math.floor(players.length * 0.9)]?.now_cost / 10 || 0,
    };

    result[positionName] = { averagePoints, topPerformers, priceRanges };
  });

  return result;
}

function calculateTransferTrends(elements: any[]): RAGData["transferTrends"] {
  const byIn = [...elements].sort(
    (a, b) => (b.transfers_in_event || 0) - (a.transfers_in_event || 0)
  );
  const byOut = [...elements].sort(
    (a, b) => (b.transfers_out_event || 0) - (a.transfers_out_event || 0)
  );
  const rising = [...elements]
    .filter((p) => (p.cost_change_event || 0) > 0)
    .sort((a, b) => (b.cost_change_event || 0) - (a.cost_change_event || 0));
  const falling = [...elements]
    .filter((p) => (p.cost_change_event || 0) < 0)
    .sort((a, b) => (a.cost_change_event || 0) - (b.cost_change_event || 0));

  return {
    mostTransferredIn: byIn.slice(0, 5).map((p) => p.web_name),
    mostTransferredOut: byOut.slice(0, 5).map((p) => p.web_name),
    risingPrices: rising.slice(0, 5).map((p) => p.web_name),
    fallingPrices: falling.slice(0, 5).map((p) => p.web_name),
  };
}

function calculateFormLeaders(elements: any[]): RAGData["formLeaders"] {
  return [...elements]
    .sort((a, b) => parseFloat(b.form || "0") - parseFloat(a.form || "0"))
    .slice(0, 5)
    .map((p) => ({ player: p.web_name, form: parseFloat(p.form || "0") }));
}

function calculateXgLeaders(elements: any[]): RAGData["xgLeaders"] {
  return [...elements]
    .sort(
      (a, b) =>
        parseFloat(b.expected_goals || "0") - parseFloat(a.expected_goals || "0")
    )
    .slice(0, 5)
    .map((p) => ({
      player: p.web_name,
      xG: parseFloat(p.expected_goals || "0"),
      xA: parseFloat(p.expected_assists || "0"),
    }));
}

function calculateAvailabilityConcerns(
  elements: any[]
): RAGData["availabilityConcerns"] {
  return elements
    .filter(
      (p) =>
        p.status &&
        p.status !== "a" &&
        parseFloat(p.selected_by_percent || "0") > 2
    )
    .sort(
      (a, b) =>
        parseFloat(b.selected_by_percent || "0") -
        parseFloat(a.selected_by_percent || "0")
    )
    .slice(0, 8)
    .map((p) => {
      const availability = getAvailability(
        p.status,
        p.chance_of_playing_next_round,
        p.news
      );
      return {
        player: p.web_name,
        status: availability?.label || "Available",
        chanceOfPlaying: p.chance_of_playing_next_round ?? null,
        news: p.news || "",
      };
    });
}

export async function POST(request: NextRequest) {
  try {
    const { elements, fixtures, currentGameweek, gameweekFinished } =
      await request.json();

    if (!elements) {
      return NextResponse.json(
        { error: "Missing elements data" },
        { status: 400 }
      );
    }

    // Exclude fringe players (backups, youth, one-off cameos) from analysis -
    // require at least 1/3 of the season's possible minutes so far.
    const gamesPlayed = getGamesPlayed(currentGameweek, !!gameweekFinished);
    const minValidMinutes = getMinValidMinutes(gamesPlayed);
    const validElements = elements.filter(
      (p: any) => (p.minutes || 0) >= minValidMinutes
    );

    const ragData: RAGData = {
      positionAverages: calculatePositionAverages(validElements),
      transferTrends: calculateTransferTrends(validElements),
      formLeaders: calculateFormLeaders(validElements),
      xgLeaders: calculateXgLeaders(validElements),
      availabilityConcerns: calculateAvailabilityConcerns(elements),
      nextGameweekFixtures:
        fixtures?.filter((f: any) => f.event === currentGameweek + 1) || [],
    };

    return NextResponse.json({
      ragData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error computing RAG data:", error);
    return NextResponse.json(
      { error: "Failed to compute RAG data" },
      { status: 500 }
    );
  }
}
