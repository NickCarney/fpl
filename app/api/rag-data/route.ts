import { NextRequest, NextResponse } from 'next/server';
import { fplScraper } from '@/lib/fpl-scraper';

// External data sources for RAG
const DATA_SOURCES = {
  // FPL Analytics APIs
  fplAnalytics: 'https://fplanalytics.com/api',
  
  // Predicted lineups (multiple sources)
  lineupSources: [
    'https://www.fantasyfootballscout.co.uk/team-news/',
    'https://www.premierleague.com/news',
    'https://twitter.com/BenCrellin' // For rotation/lineup predictions
  ],
  
  // Statistical sources
  understat: 'https://understat.com',
  fbref: 'https://fbref.com'
};

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
  nextGameweekFixtures: any[];
  transferTrends: {
    mostTransferredIn: string[];
    mostTransferredOut: string[];
    risingPrices: string[];
    fallingPrices: string[];
  };
}

async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Basic text extraction (in a real implementation, you'd use a proper HTML parser)
    const cleanText = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanText.substring(0, 5000); // Limit to avoid token overflow
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return '';
  }
}

async function calculatePositionAverages(elements: any[]): Promise<RAGData['positionAverages']> {
  const positions = {
    'Goalkeeper': { id: 1, players: [] as any[] },
    'Defender': { id: 2, players: [] as any[] },
    'Midfielder': { id: 3, players: [] as any[] },
    'Forward': { id: 4, players: [] as any[] },
  };

  // Group players by position
  elements.forEach(player => {
    const positionName = Object.keys(positions).find(pos => 
      positions[pos as keyof typeof positions].id === player.element_type
    );
    if (positionName) {
      positions[positionName as keyof typeof positions].players.push(player);
    }
  });

  const result: RAGData['positionAverages'] = {};

  Object.entries(positions).forEach(([positionName, data]) => {
    const players = data.players;
    if (players.length === 0) return;

    // Calculate averages
    const averagePoints = players.reduce((sum, p) => sum + p.total_points, 0) / players.length;
    
    // Get top performers (top 10% by points)
    const sortedByPoints = players.sort((a, b) => b.total_points - a.total_points);
    const topPerformers = sortedByPoints.slice(0, Math.ceil(players.length * 0.1))
      .map(p => p.web_name);

    // Price ranges
    const sortedByPrice = players.sort((a, b) => a.now_cost - b.now_cost);
    const priceRanges = {
      budget: sortedByPrice[Math.floor(players.length * 0.33)]?.now_cost / 10 || 0,
      mid: sortedByPrice[Math.floor(players.length * 0.66)]?.now_cost / 10 || 0,
      premium: sortedByPrice[Math.floor(players.length * 0.9)]?.now_cost / 10 || 0,
    };

    result[positionName] = {
      averagePoints,
      topPerformers,
      priceRanges,
    };
  });

  return result;
}

async function fetchTransferTrends(elements: any[]): Promise<RAGData['transferTrends']> {
  // Use actual FPL API data for transfer trends
  try {
    // Sort by transfers in this gameweek
    const sortedByTransfersIn = [...elements]
      .filter(p => p.transfers_in_event > 0)
      .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
      .slice(0, 10);

    const sortedByTransfersOut = [...elements]
      .filter(p => p.transfers_out_event > 0)
      .sort((a, b) => b.transfers_out_event - a.transfers_out_event)
      .slice(0, 10);

    // Price changes - those with cost_change_event != 0
    const risingPrices = [...elements]
      .filter(p => p.cost_change_event > 0)
      .sort((a, b) => b.cost_change_event - a.cost_change_event)
      .slice(0, 10)
      .map(p => p.web_name);

    const fallingPrices = [...elements]
      .filter(p => p.cost_change_event < 0)
      .sort((a, b) => a.cost_change_event - b.cost_change_event)
      .slice(0, 10)
      .map(p => p.web_name);

    return {
      mostTransferredIn: sortedByTransfersIn.map(p => p.web_name),
      mostTransferredOut: sortedByTransfersOut.map(p => p.web_name),
      risingPrices: risingPrices.length > 0 ? risingPrices : ['No price rises this gameweek'],
      fallingPrices: fallingPrices.length > 0 ? fallingPrices : ['No price falls this gameweek']
    };
  } catch (error) {
    console.error('Error fetching transfer trends:', error);
    return {
      mostTransferredIn: [],
      mostTransferredOut: [],
      risingPrices: [],
      fallingPrices: []
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { elements, fixtures, currentGameweek } = await request.json();

    // Fetch enhanced scraped data
    const scrapedData = await fplScraper.scrapeAll();

    // Fetch and compile RAG data with ONLY legitimate sources
    const ragData: RAGData = {
      positionAverages: await calculatePositionAverages(elements),
      nextGameweekFixtures: fixtures?.filter((f: any) => f.event === currentGameweek + 1) || [],
      transferTrends: await fetchTransferTrends(elements),
    };

    // Enhanced external content with scraped data
    const externalContent = {
      teamNews: scrapedData.teamNews,
      analytics: scrapedData.analytics,
      predictions: scrapedData.predictions,
      lineupData: scrapedData.lineup,
      // Add summary text for the AI
      summary: `
Latest FPL Intelligence:
- xG Leaders: ${scrapedData.analytics.xGData.slice(0, 3).map(p => `${p.player} (${p.xG})`).join(', ')}
- Form Rising: ${scrapedData.analytics.formTable.filter(p => p.trend === 'rising').map(p => p.player).join(', ')}
- Predicted Lineups Available: ${scrapedData.lineup.predicted.length > 0 ? 'Yes' : 'No'}
- Community Predictions: ${scrapedData.predictions.map(p => `${p.source}: ${p.predictions.length} insights`).join(', ')}
      `.trim()
    };

    return NextResponse.json({
      ragData,
      externalContent,
      scrapedData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching RAG data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RAG data' },
      { status: 500 }
    );
  }
}
