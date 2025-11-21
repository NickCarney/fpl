// FPL API Response Types

export interface Element {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  form: string;
  selected_by_percent: string;
  ict_index: string;
  points_per_game: string;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
}

export interface Team {
  id: number;
  name: string;
  short_name: string;
  code: number;
  position: number;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface ElementType {
  id: number;
  plural_name: string;
  plural_name_short: string;
  singular_name: string;
  singular_name_short: string;
  squad_select: number;
  squad_min_play: number;
  squad_max_play: number;
}

export interface Event {
  id: number;
  name: string;
  deadline_time: string;
  average_entry_score: number;
  finished: boolean;
  data_checked: boolean;
  highest_scoring_entry: number;
  deadline_time_epoch: number;
  deadline_time_game_offset: number;
  highest_score: number;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  cup_leagues_created: boolean;
  h2h_ko_matches_created: boolean;
  chip_plays: any[];
  most_selected: number;
  most_transferred_in: number;
  top_element: number;
  top_element_info: any;
  transfers_made: number;
  most_captained: number;
  most_vice_captained: number;
}

export interface Fixture {
  code: number;
  event: number;
  finished: boolean;
  finished_provisional: boolean;
  id: number;
  kickoff_time: string;
  minutes: number;
  provisional_start_time: boolean;
  started: boolean;
  team_a: number;
  team_a_score: number;
  team_h: number;
  team_h_score: number;
  stats: any[];
  team_h_difficulty: number;
  team_a_difficulty: number;
  pulse_id: number;
}

export interface BootstrapStatic {
  events: Event[];
  game_settings: any;
  phases: any[];
  teams: Team[];
  total_players: number;
  elements: Element[];
  element_types: ElementType[];
  element_stats: any[];
}

export interface Pick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  selling_price?: number;
  purchase_price?: number;
}

export interface TeamPicks {
  active_chip: string | null;
  automatic_subs: any[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    rank_sort: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
  picks: Pick[];
  transfers?: {
    cost: number;
    status: string;
    limit: number | null;
    made: number;
    bank: number;
    value: number;
  };
}

export interface LeagueStanding {
  id: number;
  event_total: number;
  player_name: string;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  entry: number;
  entry_name: string;
}

export interface League {
  id: number;
  name: string;
  created: string;
  closed: boolean;
  max_entries: number | null;
  league_type: string;
  scoring: string;
  admin_entry: number;
  start_event: number;
  code_privacy: string;
  has_cup: boolean;
  cup_league: number | null;
  rank: number | null;
}

export interface LeagueStandings {
  league: League;
  new_entries: {
    has_next: boolean;
    page: number;
    results: any[];
  };
  last_updated_data: string;
  standings: {
    has_next: boolean;
    page: number;
    results: LeagueStanding[];
  };
}

export interface SeasonHistory {
  season_name: string;
  total_points: number;
  rank: number;
}

export interface ChipPlay {
  name: string;
  time: string;
  event: number;
}

export interface PastSeason {
  season_name: string;
  total_points: number;
  rank: number;
}

export interface Current {
  event: number;
  points: number;
  total_points: number;
  rank: number;
  rank_sort: number;
  overall_rank: number;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
}

export interface TeamHistory {
  current: Current[];
  past: PastSeason[];
  chips: ChipPlay[];
}

export interface TeamInfo {
  id: number;
  joined_time: string;
  started_event: number;
  favourite_team: number;
  player_first_name: string;
  player_last_name: string;
  player_region_id: number;
  player_region_name: string;
  player_region_iso_code_short: string;
  player_region_iso_code_long: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  summary_event_points: number;
  summary_event_rank: number;
  current_event: number;
  leagues: any;
  name: string;
  name_change_blocked: boolean;
  kit: any;
  last_deadline_bank: number;
  last_deadline_value: number;
  last_deadline_total_transfers: number;
}

export interface PlayerGameweek {
  element: number;
  fixture: number;
  opponent_team: number;
  total_points: number;
  was_home: boolean;
  kickoff_time: string;
  team_h_score: number;
  team_a_score: number;
  round: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  value: number;
  transfers_balance: number;
  selected: number;
  transfers_in: number;
  transfers_out: number;
}

export interface PlayerGameweekData {
  fixtures: any[];
  history: PlayerGameweek[];
  history_past: any[];
}
