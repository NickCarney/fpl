import { JSDOM } from 'jsdom';

interface ScrapedData {
  teamNews: TeamNewsData[];
  predictions: PredictionData[];
  analytics: AnalyticsData;
  lineup: LineupData;
}

interface TeamNewsData {
  team: string;
  players: {
    name: string;
    status: 'injured' | 'doubt' | 'suspended' | 'available';
    details: string;
  }[];
}

interface PredictionData {
  source: string;
  predictions: {
    player: string;
    prediction: string;
    confidence: number;
  }[];
}

interface AnalyticsData {
  xGData: { player: string; xG: number; xA: number }[];
  formTable: { player: string; form: number; trend: string }[];
  valueData: { player: string; value: number; priceChange: number }[];
}

interface LineupData {
  team: string;
  predicted: string[];
  rotation: string[];
  nailed: string[];
}

export class FPLDataScraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async fetchHTML(url: string): Promise<Document | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const dom = new JSDOM(html);
      return dom.window.document;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      return null;
    }
  }

  async scrapeFantasyFootballScout(): Promise<TeamNewsData[]> {
    const teamNews: TeamNewsData[] = [];
    
    try {
      // Scrape FFS team news
      const doc = await this.fetchHTML('https://www.fantasyfootballscout.co.uk/team-news/');
      if (!doc) return teamNews;

      // Extract team news data (this would need to be adapted to actual HTML structure)
      const newsItems = doc.querySelectorAll('.team-news-item');
      
      newsItems.forEach(item => {
        const teamElement = item.querySelector('.team-name');
        const playersElement = item.querySelector('.players-list');
        
        if (teamElement && playersElement) {
          const team = teamElement.textContent?.trim() || '';
          const players: TeamNewsData['players'] = [];
          
          const playerItems = playersElement.querySelectorAll('.player-item');
          playerItems.forEach(playerItem => {
            const name = playerItem.querySelector('.player-name')?.textContent?.trim() || '';
            const statusElement = playerItem.querySelector('.player-status');
            const status = this.parsePlayerStatus(statusElement?.textContent?.trim() || '');
            const details = playerItem.querySelector('.player-details')?.textContent?.trim() || '';
            
            if (name) {
              players.push({ name, status, details });
            }
          });
          
          if (team && players.length > 0) {
            teamNews.push({ team, players });
          }
        }
      });
    } catch (error) {
      console.error('Error scraping Fantasy Football Scout:', error);
    }

    return teamNews;
  }

  async scrapeFPLAnalytics(): Promise<AnalyticsData> {
    const analytics: AnalyticsData = {
      xGData: [],
      formTable: [],
      valueData: []
    };

    try {
      // This would scrape expected goals data from analytics sites
      // For demo purposes, returning structured sample data
      analytics.xGData = [
        { player: 'Haaland', xG: 12.5, xA: 3.2 },
        { player: 'Salah', xG: 8.9, xA: 5.1 },
        { player: 'Palmer', xG: 6.7, xA: 4.8 }
      ];

      analytics.formTable = [
        { player: 'Palmer', form: 8.2, trend: 'rising' },
        { player: 'Rogers', form: 7.1, trend: 'rising' },
        { player: 'Isak', form: 4.2, trend: 'falling' }
      ];

      analytics.valueData = [
        { player: 'Palmer', value: 9.8, priceChange: 0.3 },
        { player: 'Rogers', value: 8.1, priceChange: 0.2 },
        { player: 'Isak', value: 6.5, priceChange: -0.1 }
      ];
    } catch (error) {
      console.error('Error scraping analytics data:', error);
    }

    return analytics;
  }

  async scrapePredictedLineups(): Promise<LineupData[]> {
    const lineups: LineupData[] = [];

    try {
      // Scrape Ben Crellin's rotation data (Twitter/X would require API)
      // For now, return sample structured data
      const sampleLineups = [
        {
          team: 'Arsenal',
          predicted: ['Raya', 'Saliba', 'Gabriel', 'Timber', 'Rice', 'Odegaard', 'Martinelli'],
          rotation: ['Partey', 'Jorginho'],
          nailed: ['Saliba', 'Rice', 'Saka']
        },
        {
          team: 'Manchester City',
          predicted: ['Ederson', 'Walker', 'Dias', 'Gvardiol', 'Haaland'],
          rotation: ['Stones', 'Ake', 'Grealish'],
          nailed: ['Haaland', 'Foden']
        }
      ];

      return sampleLineups;
    } catch (error) {
      console.error('Error scraping lineup predictions:', error);
      return lineups;
    }
  }

  async scrapeRedditFPL(): Promise<PredictionData[]> {
    const predictions: PredictionData[] = [];

    try {
      // This would scrape r/FantasyPL for community insights
      // Reddit API would be preferred over scraping
      predictions.push({
        source: 'r/FantasyPL',
        predictions: [
          { player: 'Palmer', prediction: 'Essential pick for the next few gameweeks', confidence: 85 },
          { player: 'Isak', prediction: 'Avoid due to tough fixtures', confidence: 70 },
          { player: 'Rogers', prediction: 'Great differential option', confidence: 60 }
        ]
      });
    } catch (error) {
      console.error('Error scraping Reddit FPL:', error);
    }

    return predictions;
  }

  private parsePlayerStatus(status: string): 'injured' | 'doubt' | 'suspended' | 'available' {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('injured') || lowerStatus.includes('injury')) return 'injured';
    if (lowerStatus.includes('doubt') || lowerStatus.includes('fitness')) return 'doubt';
    if (lowerStatus.includes('suspended') || lowerStatus.includes('ban')) return 'suspended';
    return 'available';
  }

  async scrapeAll(): Promise<ScrapedData> {
    const [teamNews, analytics, lineup, predictions] = await Promise.all([
      this.scrapeFPLAnalytics(),
      this.scrapeFPLAnalytics(),
      this.scrapePredictedLineups(),
      this.scrapeRedditFPL()
    ]);

    return {
      teamNews: [],
      predictions,
      analytics,
      lineup: lineup[0] || { team: '', predicted: [], rotation: [], nailed: [] }
    };
  }
}

export const fplScraper = new FPLDataScraper();
