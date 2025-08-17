# ⚽ Fantasy Premier League Dashboard (Next.js)

This project is a Next.js web app that consumes the **Fantasy Premier League (FPL) API** to provide insights into your team, leagues, and players.  
The FPL API is undocumented but public and widely used by the community.

---

## Features

- View your **current squad** and points for each gameweek.
- **Formation view** with tactical layout on a football pitch.
- **Player detail popups** with comprehensive stats and game-by-game performance.
- Track **live scores** as matches update.
- Display **mini-league standings** for Classic or Head-to-Head leagues.
- Explore **player stats** (form, price, ICT index, upcoming fixtures).
- Visualize your **season history** (rank, points, chip usage).
- **AI-powered team insights** analyzing your squad's strengths and weaknesses.

---

## Tech Stack

- [Next.js 15](https://nextjs.org/) – React framework
- [TypeScript](https://www.typescriptlang.org/) – optional but recommended
- [Tailwind CSS](https://tailwindcss.com/) – styling
- [Chart.js / Recharts](https://recharts.org/) – data visualizations

---

## FPL API Endpoints Used

Some key endpoints:

- **Bootstrap static (all players, teams, fixtures)**  
  `https://fantasy.premierleague.com/api/bootstrap-static/`

- **Team picks (your lineup in a given GW)**  
  `https://fantasy.premierleague.com/api/entry/{TEAM_ID}/event/{GW}/picks/`

- **Team history**  
  `https://fantasy.premierleague.com/api/entry/{TEAM_ID}/history/`

- **Classic league standings**  
  `https://fantasy.premierleague.com/api/leagues-classic/{LEAGUE_ID}/standings/`

---

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/fpl-dashboard.git
   cd fpl-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional)**
   ```bash
   cp .env.example .env.local
   ```
   Add your OpenAI API key to enable AI-powered team insights:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   *Note: Team insights will work with basic analysis even without an API key*

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` and enter your FPL Team ID
