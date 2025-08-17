# ⚽ Fantasy Premier League Dashboard (Next.js)

This project is a Next.js web app that consumes the **Fantasy Premier League (FPL) API** to provide insights into your team, leagues, and players.  
The FPL API is undocumented but public and widely used by the community.

---

## Features

- View your **current squad** and points for each gameweek.
- Track **live scores** as matches update.
- Display **mini-league standings** for Classic or Head-to-Head leagues.
- Explore **player stats** (form, price, ICT index, upcoming fixtures).
- Visualize your **season history** (rank, points, chip usage).

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
