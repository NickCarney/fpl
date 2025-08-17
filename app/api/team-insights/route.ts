import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamData, squadData, currentGameweek, gameweekFinished, fixtures } = body;

    if (!teamData || !squadData) {
      return NextResponse.json(
        { error: 'Missing required team or squad data' },
        { status: 400 }
      );
    }

    // Prepare data for analysis
    const squadAnalysis = squadData.map((player: any) => ({
      name: player.web_name,
      position: player.position_name,
      team: player.team_name,
      teamId: player.team,
      points: player.total_points,
      form: player.form,
      price: player.now_cost / 10,
      minutes: player.minutes,
      goals: player.goals_scored,
      assists: player.assists,
      cleanSheets: player.clean_sheets,
      isCaptain: player.is_captain,
      isViceCaptain: player.is_vice_captain,
    }));

    // Analyze current gameweek fixtures for each team
    const currentGameweekFixtures = fixtures?.filter((fixture: any) => 
      fixture.event === currentGameweek
    ) || [];

    const teamFixtureStatus = new Map();
    currentGameweekFixtures.forEach((fixture: any) => {
      teamFixtureStatus.set(fixture.team_h, {
        hasPlayed: fixture.finished,
        opponent: fixture.team_a,
        isHome: true,
        started: fixture.started
      });
      teamFixtureStatus.set(fixture.team_a, {
        hasPlayed: fixture.finished,
        opponent: fixture.team_h,
        isHome: false,
        started: fixture.started
      });
    });

    // Add fixture context to squad analysis
    const squadWithFixtures = squadAnalysis.map((player: any) => {
      const fixtureInfo = teamFixtureStatus.get(player.teamId);
      return {
        ...player,
        hasPlayedThisGW: fixtureInfo?.hasPlayed || false,
        gameStarted: fixtureInfo?.started || false,
      };
    });

    const gameweekStatusText = gameweekFinished 
      ? "Gameweek has finished" 
      : "Gameweek is ongoing - some matches may not have been played yet";

    const prompt = `
Analyze this Fantasy Premier League team and provide 3-4 concise, insightful observations. 

IMPORTANT CONTEXT: ${gameweekStatusText}

Team Overview:
- Total Points: ${teamData.totalPoints}
- Current Gameweek: ${currentGameweek}
- Squad Value: £${squadData.reduce((sum: number, p: any) => sum + (p.now_cost / 10), 0).toFixed(1)}m

Squad Details:
${squadWithFixtures.map((p: any) => 
  `${p.name} (${p.team}) - ${p.position}: ${p.points}pts, Form: ${p.form}, £${p.price}m, ${p.minutes} mins${p.isCaptain ? ' [CAPTAIN]' : ''}${p.isViceCaptain ? ' [VC]' : ''}${!p.hasPlayedThisGW ? ' [NOT PLAYED YET THIS GW]' : ''}`
).join('\n')}

When analyzing:
- If a player shows "[NOT PLAYED YET THIS GW]", DO NOT criticize them for low points this gameweek
- Focus on overall season performance, form, and fixture difficulty
- Consider upcoming matches for players who haven't played yet
- Only suggest transfers for players with genuine long-term concerns, not those who simply haven't played this gameweek

Provide insights about:
1. **Best Performers**: Who are the standout players and why?
2. **Areas of Concern**: Which players or positions need attention (based on season form, not this gameweek)?
3. **Team Balance**: Comment on the overall strategy and balance
4. **Captain Choice**: Evaluate the current captaincy decision

Keep each insight to 1-2 sentences. Be specific about player names and stats. Use a conversational, expert FPL manager tone.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert Fantasy Premier League analyst providing concise, actionable insights about team performance and strategy."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const insights = completion.choices[0]?.message?.content || "Unable to generate insights at this time.";

    return NextResponse.json({ insights });

  } catch (error) {
    console.error('Error generating team insights:', error);
    
    // Return fallback insights if OpenAI fails
    const fallbackInsights = `
**Team Analysis**
• Your squad is performing at a solid level for the current gameweek
• Consider monitoring players with low minutes for potential rotation risks (check season totals, not just this gameweek)
• Review your captain choice based on upcoming fixtures and form
• Balance your budget between premium assets and value picks
• Note: Some players may not have played yet this gameweek - check fixture schedules before making transfer decisions
    `.trim();

    return NextResponse.json({ 
      insights: fallbackInsights,
      fallback: true 
    });
  }
}
