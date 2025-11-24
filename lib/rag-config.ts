export const RAG_CONFIG = {
  // Data source URLs and configurations
  dataSources: {
    // Team news and injury updates
    fantasyFootballScout: {
      teamNewsUrl: "https://www.fantasyfootballscout.co.uk/team-news/",
      teamNewsSelector: ".team-news-item",
      enabled: true,
    },

    // Expected goals and analytics
    understat: {
      playersUrl: "https://understat.com/league/EPL",
      enabled: true,
    },

    // Transfer trends and ownership
    fplGameweek: {
      transfersUrl: "https://www.fplgameweek.com/transfers",
      enabled: true,
    },

    // Reddit community insights
    reddit: {
      baseUrl: "https://www.reddit.com/r/FantasyPL",
      enabled: false, // Requires API key
    },

    // Ben Crellin rotation data
    benCrellin: {
      twitterHandle: "@BenCrellin",
      enabled: false, // Would need Twitter API
    },

    // FPL Statistics
    fplStatistics: {
      baseUrl: "https://www.fplstatistics.co.uk",
      enabled: true,
    },
  },

  // AI Model configuration
  openAI: {
    model: "gpt-5-nano" as const,
    maxTokens: 800,
    temperature: 0.2,
    reasoning_effort: "minimal" as const,
    systemPrompt: `You are an elite Fantasy Premier League analyst with access to comprehensive real-time data including:
    - Expected goals (xG) and expected assists (xA) statistics
    - Transfer market trends and ownership data
    - Predicted lineups and rotation information
    - Expert opinions and community sentiment
    - Historical performance benchmarks

    Provide data-driven, specific, and actionable FPL advice.`,
  },

  // Scraping settings
  scraping: {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    timeout: 10000,
    retries: 3,
    rateLimit: 1000, // ms between requests
  },

  // Cache settings
  cache: {
    ragDataTTL: 300000, // 5 minutes
    scrapedDataTTL: 900000, // 15 minutes
    positionAveragesTTL: 3600000, // 1 hour
  },

  // Feature flags
  features: {
    enableWebScraping: true,
    enableExternalAPIs: true,
    enableCaching: true,
    enableFallback: true,
  },

  // External API endpoints (if available)
  apis: {
    fplAnalytics: process.env.FPL_ANALYTICS_API_KEY
      ? "https://fplanalytics.com/api"
      : null,
    understatAPI: process.env.UNDERSTAT_API_KEY
      ? "https://understat.com/api"
      : null,
    redditAPI: process.env.REDDIT_API_KEY ? "https://oauth.reddit.com" : null,
  },
};
