/**
 * Team Grading Algorithm for "Rate my team"
 *
 * Grades team on a 0-100 scale based on:
 * 1. Weekly Performance vs Average (35 points)
 * 2. Personal League Rankings (30 points)
 * 3. Overall Rank (15 points)
 * 4. Team Value & Strategy (10 points)
 * 5. Recent Form (10 points)
 */

import { getPool, sql } from "@/lib/db.js";

interface TeamData {
  totalPoints: number;
  currentGameweek: number;
  overallRank?: number;
  teamValue?: number;
  bank?: number;
}

interface SquadData {
  form?: string;
  price?: number;
  points?: number;
}

export async function calculateTeamGrade(
  teamData: TeamData,
  squadData: SquadData[],
  currentGameweek: number,
  teamHistory?: any,
  userLeagues?: any[]
): Promise<{ grade: number; breakdown: any }> {
  let score = 0;
  let maxScore = 0;
  const breakdown: any = {};

  try {
    const pool = await getPool();

    // 1. Weekly Performance vs Average (35 points max)
    if (teamHistory && teamHistory.current && teamHistory.current.length > 0) {
      // Get ALL events with average scores
      const eventsResult = await pool.request().query(`
        SELECT id, average_entry_score
        FROM dbo.events
        WHERE average_entry_score IS NOT NULL
        ORDER BY id
      `);
      const events = eventsResult.recordset;

      let weeksAboveAverage = 0;
      let totalWeeksCompared = 0;
      let totalMargin = 0;
      const weeklyDetails: any[] = [];

      // Compare ALL gameweeks in history
      teamHistory.current.forEach((gw: any) => {
        const event = events.find((e: any) => e.id === gw.event);
        if (event && event.average_entry_score > 0) {
          totalWeeksCompared++;
          const userPoints = gw.points || 0;
          const avgPoints = event.average_entry_score;
          const margin = userPoints - avgPoints;

          if (margin > 0) {
            weeksAboveAverage++;
          }
          totalMargin += margin;

          weeklyDetails.push({
            gw: gw.event,
            userPoints,
            avgPoints,
            margin: margin.toFixed(1),
          });
        }
      });

      if (totalWeeksCompared > 0) {
        // Score based on % of weeks above average (20 points)
        const pctAboveAvg = weeksAboveAverage / totalWeeksCompared;
        const weeksScore = pctAboveAvg * 20;
        score += weeksScore;

        // Score based on average margin (15 points)
        // Normalize: +10 points above average = full score, -10 = zero
        const avgMargin = totalMargin / totalWeeksCompared;
        const marginScore =
          Math.min(Math.max((avgMargin + 10) / 20, 0), 1) * 15;
        score += marginScore;

        breakdown.weeklyPerformance = {
          score: (weeksScore + marginScore).toFixed(1),
          max: 35,
          weeksAboveAverage,
          totalWeeks: totalWeeksCompared,
          pctAboveAvg: (pctAboveAvg * 100).toFixed(1) + "%",
          avgMargin: avgMargin.toFixed(1),
          totalMargin: totalMargin.toFixed(1),
        };
      }
    }
    maxScore += 35;

    // 2. Personal League Rankings (30 points max)
    // Consider BOTH overall rank AND private league performance
    // This gives 15 points for private leagues + 15 from overall rank section
    if (userLeagues && userLeagues.length > 0) {
      const privateLeagues = userLeagues.filter((league: any) => {
        // League types: "s" = standard/public, "x" = private/invitational
        // We want private leagues ("x"), not standard public leagues ("s")
        if (league.league_type !== "x") {
          return false;
        }

        // league_type "x" means it's a private/invitational league
        // These are the friend leagues we want to include
        return true;
      });

      if (privateLeagues.length > 0) {
        let totalRankScore = 0;
        let bestPercentile = 0;
        const leagueDetails: any[] = [];

        for (const league of privateLeagues) {
          if (league.entry_rank) {
            // Determine league size from available data
            // Priority: rank_count (most accurate) > max_entries > default
            let leagueSize = 20; // Default for small friend leagues

            if (league.rank_count) {
              // Use the actual count of entries in the league
              leagueSize = league.rank_count;
            } else if (league.max_entries && league.max_entries < 100000) {
              leagueSize = league.max_entries;
            }

            // Calculate percentile (1.0 = 1st place, 0.0 = last place)
            const rankPercentile = 1 - (league.entry_rank - 1) / leagueSize;
            const clampedPercentile = Math.max(Math.min(rankPercentile, 1), 0);

            totalRankScore += clampedPercentile;
            bestPercentile = Math.max(bestPercentile, clampedPercentile);

            leagueDetails.push({
              name: league.name,
              rank: league.entry_rank,
              size: leagueSize,
              percentile: (clampedPercentile * 100).toFixed(1) + "%",
            });
          }
        }

        if (privateLeagues.length > 0) {
          // Use the BETTER of: average performance or best league performance
          // This rewards being 1st in even one league
          const avgRankPercentile = totalRankScore / privateLeagues.length;
          const finalPercentile = Math.max(avgRankPercentile, bestPercentile * 0.8);

          // Scale to 30 points max, with bonus for being 1st in any league
          let leagueScore = finalPercentile * 30;

          // Extra bonus for being 1st in any private league (up to +5 points)
          const has1stPlace = privateLeagues.some((l: any) => l.entry_rank === 1);
          if (has1stPlace) {
            leagueScore = Math.min(leagueScore + 5, 30);
          }

          score += leagueScore;

          breakdown.privateLeagues = {
            score: leagueScore.toFixed(1),
            max: 30,
            count: privateLeagues.length,
            avgPercentile: (avgRankPercentile * 100).toFixed(1) + "%",
            bestPercentile: (bestPercentile * 100).toFixed(1) + "%",
            has1stPlace,
            leagues: leagueDetails,
          };
        }
      } else {
        // No private leagues found - give moderate score
        score += 15;
        breakdown.privateLeagues = {
          score: 15,
          max: 30,
          count: 0,
          note: "No private classic leagues found - gave moderate score",
          totalLeagues: userLeagues.length,
        };
      }
    } else {
      // No league data
      score += 15;
      breakdown.privateLeagues = {
        score: 15,
        max: 30,
        count: 0,
        note: "No league data available",
      };
    }
    maxScore += 30;

    // 3. Overall Rank (15 points max)
    if (teamData.overallRank) {
      const totalPlayers = 13000000; // Approx FPL players
      const rankPercentile = 1 - teamData.overallRank / totalPlayers;
      const rankScore = rankPercentile * 15;
      score += rankScore;

      breakdown.overallRank = {
        score: rankScore,
        max: 15,
        rank: teamData.overallRank,
        percentile: (rankPercentile * 100).toFixed(2) + "%",
      };
    } else {
      score += 7.5;
      breakdown.overallRank = {
        score: 7.5,
        max: 15,
        note: "No rank data",
      };
    }
    maxScore += 15;

    // 4. Team Value & Strategy (10 points max)
    if (teamData.teamValue) {
      const value = teamData.teamValue / 10; // Convert to millions
      // Starting value is 100m, good teams around 102-105m
      const valueBonus = Math.min((value - 100) / 5, 1) * 7;
      let valueScore = Math.max(valueBonus, 0);

      // Bank balance consideration
      const bank = (teamData.bank || 0) / 10;
      let bankScore = 0;
      if (bank < 1) {
        bankScore = 3; // Good - using funds efficiently
      } else if (bank < 2) {
        bankScore = 2; // Okay
      } else {
        bankScore = 1; // Too much in bank
      }

      valueScore += bankScore;
      score += valueScore;

      breakdown.teamValue = {
        score: valueScore,
        max: 10,
        value: value.toFixed(1) + "m",
        bank: bank.toFixed(1) + "m",
      };
    } else {
      score += 5;
      breakdown.teamValue = {
        score: 5,
        max: 10,
        note: "No value data",
      };
    }
    maxScore += 10;

    // 5. Recent Form (10 points max)
    const startingXI = squadData.slice(0, 11);
    const avgForm =
      startingXI.reduce(
        (sum: number, p: any) => sum + (parseFloat(p.form) || 0),
        0
      ) / 11;
    // Good form is 4+, excellent is 6+
    const formScore = Math.min(avgForm / 6, 1) * 10;
    score += formScore;

    breakdown.recentForm = {
      score: formScore,
      max: 10,
      avgForm: avgForm.toFixed(2),
    };

    maxScore += 10;

    const finalGrade = Math.round((score / maxScore) * 100);

    return {
      grade: finalGrade,
      breakdown,
    };
  } catch (error) {
    console.error("Error calculating grade:", error);
    // Return a moderate grade on error
    return {
      grade: 50,
      breakdown: { error: "Could not calculate full grade" },
    };
  }
}

export function getGradeDescription(grade: number): string {
  if (grade >= 90) {
    return "Outstanding! Your team is performing at an elite level with excellent weekly scores, strong league positions, and smart strategy.";
  } else if (grade >= 80) {
    return "Excellent team! You're consistently beating averages and ranking well in your leagues.";
  } else if (grade >= 70) {
    return "Good team! You're performing above average with solid weekly scores and decent league positions.";
  } else if (grade >= 60) {
    return "Decent team! You're around average - focus on consistent weekly performance and climbing league ranks.";
  } else if (grade >= 50) {
    return "Room for improvement. Work on beating weekly averages and improving your league standings.";
  } else {
    return "Needs work. Focus on selecting in-form players and making strategic transfers to boost your weekly scores.";
  }
}
