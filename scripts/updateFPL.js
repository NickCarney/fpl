import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// SQL Server configuration
const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// FPL API base URL
const FPL_BASE_URL = 'https://fantasy.premierleague.com/api';

// Helper: Fetch with retry logic
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Fetching: ${url} (attempt ${i + 1}/${retries})`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

// Helper: Execute query with transaction support
async function executeQuery(pool, query, params = {}) {
  try {
    const request = pool.request();
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });
    return await request.query(query);
  } catch (error) {
    console.error('Query execution error:', error.message);
    throw error;
  }
}

// Upsert teams
async function upsertTeams(pool, teams) {
  console.log(`\nUpserting ${teams.length} teams...`);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    for (const team of teams) {
      const request = new sql.Request(transaction);
      await request
        .input('id', sql.Int, team.id)
        .input('name', sql.NVarChar, team.name)
        .input('short_name', sql.NVarChar, team.short_name)
        .input('code', sql.Int, team.code)
        .input('strength', sql.Int, team.strength)
        .input('strength_overall_home', sql.Int, team.strength_overall_home)
        .input('strength_overall_away', sql.Int, team.strength_overall_away)
        .input('strength_attack_home', sql.Int, team.strength_attack_home)
        .input('strength_attack_away', sql.Int, team.strength_attack_away)
        .input('strength_defence_home', sql.Int, team.strength_defence_home)
        .input('strength_defence_away', sql.Int, team.strength_defence_away)
        .input('pulse_id', sql.Int, team.pulse_id).query(`
          MERGE INTO dbo.teams AS target
          USING (SELECT @id AS id) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET
              name = @name,
              short_name = @short_name,
              code = @code,
              strength = @strength,
              strength_overall_home = @strength_overall_home,
              strength_overall_away = @strength_overall_away,
              strength_attack_home = @strength_attack_home,
              strength_attack_away = @strength_attack_away,
              strength_defence_home = @strength_defence_home,
              strength_defence_away = @strength_defence_away,
              pulse_id = @pulse_id,
              last_updated = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (id, name, short_name, code, strength, strength_overall_home,
                    strength_overall_away, strength_attack_home, strength_attack_away,
                    strength_defence_home, strength_defence_away, pulse_id)
            VALUES (@id, @name, @short_name, @code, @strength, @strength_overall_home,
                    @strength_overall_away, @strength_attack_home, @strength_attack_away,
                    @strength_defence_home, @strength_defence_away, @pulse_id);
        `);
    }

    await transaction.commit();
    console.log('✓ Teams upserted successfully');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Upsert element types (positions)
async function upsertElementTypes(pool, elementTypes) {
  console.log(`\nUpserting ${elementTypes.length} element types...`);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    for (const type of elementTypes) {
      const request = new sql.Request(transaction);
      await request
        .input('id', sql.Int, type.id)
        .input('plural_name', sql.NVarChar, type.plural_name)
        .input('plural_name_short', sql.NVarChar, type.plural_name_short)
        .input('singular_name', sql.NVarChar, type.singular_name)
        .input('singular_name_short', sql.NVarChar, type.singular_name_short)
        .input('squad_select', sql.Int, type.squad_select)
        .input('squad_min_play', sql.Int, type.squad_min_play)
        .input('squad_max_play', sql.Int, type.squad_max_play).query(`
          MERGE INTO dbo.element_types AS target
          USING (SELECT @id AS id) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET
              plural_name = @plural_name,
              plural_name_short = @plural_name_short,
              singular_name = @singular_name,
              singular_name_short = @singular_name_short,
              squad_select = @squad_select,
              squad_min_play = @squad_min_play,
              squad_max_play = @squad_max_play,
              last_updated = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (id, plural_name, plural_name_short, singular_name,
                    singular_name_short, squad_select, squad_min_play, squad_max_play)
            VALUES (@id, @plural_name, @plural_name_short, @singular_name,
                    @singular_name_short, @squad_select, @squad_min_play, @squad_max_play);
        `);
    }

    await transaction.commit();
    console.log('✓ Element types upserted successfully');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Upsert players (elements)
async function upsertPlayers(pool, players) {
  console.log(`\nUpserting ${players.length} players...`);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    let count = 0;

    for (const player of players) {
      const request = new sql.Request(transaction);
      await request
        .input('id', sql.Int, player.id)
        .input('web_name', sql.NVarChar, player.web_name)
        .input('first_name', sql.NVarChar, player.first_name)
        .input('second_name', sql.NVarChar, player.second_name)
        .input('team', sql.Int, player.team)
        .input('element_type', sql.Int, player.element_type)
        .input('code', sql.Int, player.code)
        .input('now_cost', sql.Int, player.now_cost)
        .input('cost_change_event', sql.Int, player.cost_change_event || 0)
        .input('cost_change_start', sql.Int, player.cost_change_start || 0)
        .input('total_points', sql.Int, player.total_points || 0)
        .input('event_points', sql.Int, player.event_points || 0)
        .input('form', sql.Decimal(5, 2), parseFloat(player.form) || 0)
        .input('points_per_game', sql.Decimal(5, 2), parseFloat(player.points_per_game) || 0)
        .input('selected_by_percent', sql.Decimal(5, 2), parseFloat(player.selected_by_percent) || 0)
        .input('status', sql.NVarChar(1), player.status)
        .input('news', sql.NVarChar, player.news)
        .input('news_added', sql.DateTime2, player.news_added ? new Date(player.news_added) : null)
        .input('chance_of_playing_next_round', sql.Int, player.chance_of_playing_next_round)
        .input('chance_of_playing_this_round', sql.Int, player.chance_of_playing_this_round)
        .input('minutes', sql.Int, player.minutes || 0)
        .input('goals_scored', sql.Int, player.goals_scored || 0)
        .input('assists', sql.Int, player.assists || 0)
        .input('clean_sheets', sql.Int, player.clean_sheets || 0)
        .input('goals_conceded', sql.Int, player.goals_conceded || 0)
        .input('own_goals', sql.Int, player.own_goals || 0)
        .input('penalties_saved', sql.Int, player.penalties_saved || 0)
        .input('penalties_missed', sql.Int, player.penalties_missed || 0)
        .input('yellow_cards', sql.Int, player.yellow_cards || 0)
        .input('red_cards', sql.Int, player.red_cards || 0)
        .input('saves', sql.Int, player.saves || 0)
        .input('bonus', sql.Int, player.bonus || 0)
        .input('bps', sql.Int, player.bps || 0)
        .input('expected_goals', sql.Decimal(10, 2), parseFloat(player.expected_goals) || 0)
        .input('expected_assists', sql.Decimal(10, 2), parseFloat(player.expected_assists) || 0)
        .input('expected_goal_involvements', sql.Decimal(10, 2), parseFloat(player.expected_goal_involvements) || 0)
        .input('expected_goals_conceded', sql.Decimal(10, 2), parseFloat(player.expected_goals_conceded) || 0)
        .input('influence', sql.Decimal(10, 2), parseFloat(player.influence) || 0)
        .input('creativity', sql.Decimal(10, 2), parseFloat(player.creativity) || 0)
        .input('threat', sql.Decimal(10, 2), parseFloat(player.threat) || 0)
        .input('ict_index', sql.Decimal(10, 2), parseFloat(player.ict_index) || 0)
        .input('starts', sql.Int, player.starts || 0)
        .input('influence_rank', sql.Int, player.influence_rank)
        .input('influence_rank_type', sql.Int, player.influence_rank_type)
        .input('creativity_rank', sql.Int, player.creativity_rank)
        .input('creativity_rank_type', sql.Int, player.creativity_rank_type)
        .input('threat_rank', sql.Int, player.threat_rank)
        .input('threat_rank_type', sql.Int, player.threat_rank_type)
        .input('ict_index_rank', sql.Int, player.ict_index_rank)
        .input('ict_index_rank_type', sql.Int, player.ict_index_rank_type)
        .input('corners_and_indirect_freekicks_order', sql.Int, player.corners_and_indirect_freekicks_order)
        .input('corners_and_indirect_freekicks_text', sql.NVarChar, player.corners_and_indirect_freekicks_text)
        .input('direct_freekicks_order', sql.Int, player.direct_freekicks_order)
        .input('direct_freekicks_text', sql.NVarChar, player.direct_freekicks_text)
        .input('penalties_order', sql.Int, player.penalties_order)
        .input('penalties_text', sql.NVarChar, player.penalties_text)
        .input('in_dreamteam', sql.Bit, player.in_dreamteam || false)
        .input('dreamteam_count', sql.Int, player.dreamteam_count || 0)
        .input('special', sql.Bit, player.special || false)
        .input('photo', sql.NVarChar, player.photo).query(`
          MERGE INTO dbo.players AS target
          USING (SELECT @id AS id) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET
              web_name = @web_name, first_name = @first_name, second_name = @second_name,
              team = @team, element_type = @element_type, code = @code,
              now_cost = @now_cost, cost_change_event = @cost_change_event,
              cost_change_start = @cost_change_start, total_points = @total_points,
              event_points = @event_points, form = @form, points_per_game = @points_per_game,
              selected_by_percent = @selected_by_percent, status = @status, news = @news,
              news_added = @news_added, chance_of_playing_next_round = @chance_of_playing_next_round,
              chance_of_playing_this_round = @chance_of_playing_this_round, minutes = @minutes,
              goals_scored = @goals_scored, assists = @assists, clean_sheets = @clean_sheets,
              goals_conceded = @goals_conceded, own_goals = @own_goals, penalties_saved = @penalties_saved,
              penalties_missed = @penalties_missed, yellow_cards = @yellow_cards, red_cards = @red_cards,
              saves = @saves, bonus = @bonus, bps = @bps, expected_goals = @expected_goals,
              expected_assists = @expected_assists, expected_goal_involvements = @expected_goal_involvements,
              expected_goals_conceded = @expected_goals_conceded, influence = @influence,
              creativity = @creativity, threat = @threat, ict_index = @ict_index, starts = @starts,
              influence_rank = @influence_rank, influence_rank_type = @influence_rank_type,
              creativity_rank = @creativity_rank, creativity_rank_type = @creativity_rank_type,
              threat_rank = @threat_rank, threat_rank_type = @threat_rank_type,
              ict_index_rank = @ict_index_rank, ict_index_rank_type = @ict_index_rank_type,
              corners_and_indirect_freekicks_order = @corners_and_indirect_freekicks_order,
              corners_and_indirect_freekicks_text = @corners_and_indirect_freekicks_text,
              direct_freekicks_order = @direct_freekicks_order, direct_freekicks_text = @direct_freekicks_text,
              penalties_order = @penalties_order, penalties_text = @penalties_text,
              in_dreamteam = @in_dreamteam, dreamteam_count = @dreamteam_count,
              special = @special, photo = @photo, last_updated = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (id, web_name, first_name, second_name, team, element_type, code, now_cost,
                    cost_change_event, cost_change_start, total_points, event_points, form,
                    points_per_game, selected_by_percent, status, news, news_added,
                    chance_of_playing_next_round, chance_of_playing_this_round, minutes,
                    goals_scored, assists, clean_sheets, goals_conceded, own_goals, penalties_saved,
                    penalties_missed, yellow_cards, red_cards, saves, bonus, bps, expected_goals,
                    expected_assists, expected_goal_involvements, expected_goals_conceded,
                    influence, creativity, threat, ict_index, starts, influence_rank,
                    influence_rank_type, creativity_rank, creativity_rank_type, threat_rank,
                    threat_rank_type, ict_index_rank, ict_index_rank_type,
                    corners_and_indirect_freekicks_order, corners_and_indirect_freekicks_text,
                    direct_freekicks_order, direct_freekicks_text, penalties_order, penalties_text,
                    in_dreamteam, dreamteam_count, special, photo)
            VALUES (@id, @web_name, @first_name, @second_name, @team, @element_type, @code,
                    @now_cost, @cost_change_event, @cost_change_start, @total_points, @event_points,
                    @form, @points_per_game, @selected_by_percent, @status, @news, @news_added,
                    @chance_of_playing_next_round, @chance_of_playing_this_round, @minutes,
                    @goals_scored, @assists, @clean_sheets, @goals_conceded, @own_goals,
                    @penalties_saved, @penalties_missed, @yellow_cards, @red_cards, @saves,
                    @bonus, @bps, @expected_goals, @expected_assists, @expected_goal_involvements,
                    @expected_goals_conceded, @influence, @creativity, @threat, @ict_index, @starts,
                    @influence_rank, @influence_rank_type, @creativity_rank, @creativity_rank_type,
                    @threat_rank, @threat_rank_type, @ict_index_rank, @ict_index_rank_type,
                    @corners_and_indirect_freekicks_order, @corners_and_indirect_freekicks_text,
                    @direct_freekicks_order, @direct_freekicks_text, @penalties_order, @penalties_text,
                    @in_dreamteam, @dreamteam_count, @special, @photo);
        `);

      count++;
      if (count % 50 === 0) {
        console.log(`  Processed ${count}/${players.length} players...`);
      }
    }

    await transaction.commit();
    console.log(`✓ ${players.length} players upserted successfully`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Upsert events (gameweeks)
async function upsertEvents(pool, events) {
  console.log(`\nUpserting ${events.length} events...`);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    for (const event of events) {
      const request = new sql.Request(transaction);
      await request
        .input('id', sql.Int, event.id)
        .input('name', sql.NVarChar, event.name)
        .input('deadline_time', sql.DateTime2, event.deadline_time ? new Date(event.deadline_time) : null)
        .input('average_entry_score', sql.Int, event.average_entry_score)
        .input('finished', sql.Bit, event.finished || false)
        .input('data_checked', sql.Bit, event.data_checked || false)
        .input('highest_scoring_entry', sql.Int, event.highest_scoring_entry)
        .input('highest_score', sql.Int, event.highest_score)
        .input('is_previous', sql.Bit, event.is_previous || false)
        .input('is_current', sql.Bit, event.is_current || false)
        .input('is_next', sql.Bit, event.is_next || false)
        .input('cup_leagues_created', sql.Bit, event.cup_leagues_created || false)
        .input('h2h_ko_matches_created', sql.Bit, event.h2h_ko_matches_created || false)
        .input('chip_plays', sql.NVarChar, JSON.stringify(event.chip_plays || []))
        .input('most_selected', sql.Int, event.most_selected)
        .input('most_transferred_in', sql.Int, event.most_transferred_in)
        .input('top_element', sql.Int, event.top_element)
        .input('top_element_info', sql.NVarChar, JSON.stringify(event.top_element_info || {}))
        .input('transfers_made', sql.Int, event.transfers_made)
        .input('most_captained', sql.Int, event.most_captained)
        .input('most_vice_captained', sql.Int, event.most_vice_captained).query(`
          MERGE INTO dbo.events AS target
          USING (SELECT @id AS id) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET
              name = @name, deadline_time = @deadline_time, average_entry_score = @average_entry_score,
              finished = @finished, data_checked = @data_checked, highest_scoring_entry = @highest_scoring_entry,
              highest_score = @highest_score, is_previous = @is_previous, is_current = @is_current,
              is_next = @is_next, cup_leagues_created = @cup_leagues_created,
              h2h_ko_matches_created = @h2h_ko_matches_created, chip_plays = @chip_plays,
              most_selected = @most_selected, most_transferred_in = @most_transferred_in,
              top_element = @top_element, top_element_info = @top_element_info,
              transfers_made = @transfers_made, most_captained = @most_captained,
              most_vice_captained = @most_vice_captained, last_updated = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (id, name, deadline_time, average_entry_score, finished, data_checked,
                    highest_scoring_entry, highest_score, is_previous, is_current, is_next,
                    cup_leagues_created, h2h_ko_matches_created, chip_plays, most_selected,
                    most_transferred_in, top_element, top_element_info, transfers_made,
                    most_captained, most_vice_captained)
            VALUES (@id, @name, @deadline_time, @average_entry_score, @finished, @data_checked,
                    @highest_scoring_entry, @highest_score, @is_previous, @is_current, @is_next,
                    @cup_leagues_created, @h2h_ko_matches_created, @chip_plays, @most_selected,
                    @most_transferred_in, @top_element, @top_element_info, @transfers_made,
                    @most_captained, @most_vice_captained);
        `);
    }

    await transaction.commit();
    console.log('✓ Events upserted successfully');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Upsert fixtures
async function upsertFixtures(pool, fixtures) {
  console.log(`\nUpserting ${fixtures.length} fixtures...`);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    let count = 0;

    for (const fixture of fixtures) {
      const request = new sql.Request(transaction);
      await request
        .input('id', sql.Int, fixture.id)
        .input('code', sql.Int, fixture.code)
        .input('event', sql.Int, fixture.event)
        .input('finished', sql.Bit, fixture.finished || false)
        .input('finished_provisional', sql.Bit, fixture.finished_provisional || false)
        .input('kickoff_time', sql.DateTime2, fixture.kickoff_time ? new Date(fixture.kickoff_time) : null)
        .input('minutes', sql.Int, fixture.minutes || 0)
        .input('provisional_start_time', sql.Bit, fixture.provisional_start_time || false)
        .input('started', sql.Bit, fixture.started || false)
        .input('team_a', sql.Int, fixture.team_a)
        .input('team_h', sql.Int, fixture.team_h)
        .input('team_a_score', sql.Int, fixture.team_a_score)
        .input('team_h_score', sql.Int, fixture.team_h_score)
        .input('team_a_difficulty', sql.Int, fixture.team_a_difficulty)
        .input('team_h_difficulty', sql.Int, fixture.team_h_difficulty)
        .input('stats', sql.NVarChar, JSON.stringify(fixture.stats || []))
        .input('pulse_id', sql.Int, fixture.pulse_id).query(`
          MERGE INTO dbo.fixtures AS target
          USING (SELECT @id AS id) AS source
          ON target.id = source.id
          WHEN MATCHED THEN
            UPDATE SET
              code = @code, event = @event, finished = @finished, finished_provisional = @finished_provisional,
              kickoff_time = @kickoff_time, minutes = @minutes, provisional_start_time = @provisional_start_time,
              started = @started, team_a = @team_a, team_h = @team_h, team_a_score = @team_a_score,
              team_h_score = @team_h_score, team_a_difficulty = @team_a_difficulty,
              team_h_difficulty = @team_h_difficulty, stats = @stats, pulse_id = @pulse_id,
              last_updated = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (id, code, event, finished, finished_provisional, kickoff_time, minutes,
                    provisional_start_time, started, team_a, team_h, team_a_score, team_h_score,
                    team_a_difficulty, team_h_difficulty, stats, pulse_id)
            VALUES (@id, @code, @event, @finished, @finished_provisional, @kickoff_time, @minutes,
                    @provisional_start_time, @started, @team_a, @team_h, @team_a_score, @team_h_score,
                    @team_a_difficulty, @team_h_difficulty, @stats, @pulse_id);
        `);

      count++;
      if (count % 50 === 0) {
        console.log(`  Processed ${count}/${fixtures.length} fixtures...`);
      }
    }

    await transaction.commit();
    console.log(`✓ ${fixtures.length} fixtures upserted successfully`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Update metadata
async function updateMetadata(pool) {
  console.log('\nUpdating metadata...');
  await executeQuery(
    pool,
    `UPDATE dbo.metadata SET value_datetime = GETUTCDATE(), last_updated = GETUTCDATE()
     WHERE key_name = 'last_fpl_update'`
  );
  console.log('✓ Metadata updated');
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('FPL DATA UPDATE SCRIPT');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  let pool;

  try {
    // Validate environment variables
    const required = ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Connect to SQL Server
    console.log('Connecting to SQL Server...');
    pool = await sql.connect(config);
    console.log('✓ Connected to SQL Server\n');

    // Fetch bootstrap-static data (teams, players, events, element_types)
    console.log('Fetching bootstrap-static data from FPL API...');
    const bootstrapData = await fetchWithRetry(`${FPL_BASE_URL}/bootstrap-static/`);
    console.log('✓ Bootstrap data fetched\n');

    // Upsert data in order (respect foreign key constraints)
    await upsertTeams(pool, bootstrapData.teams);
    await upsertElementTypes(pool, bootstrapData.element_types);
    await upsertEvents(pool, bootstrapData.events);
    await upsertPlayers(pool, bootstrapData.elements);

    // Fetch and upsert fixtures
    console.log('\nFetching fixtures from FPL API...');
    const fixtures = await fetchWithRetry(`${FPL_BASE_URL}/fixtures/`);
    console.log(`✓ Fetched ${fixtures.length} fixtures\n`);
    await upsertFixtures(pool, fixtures);

    // Update metadata
    await updateMetadata(pool);

    console.log('\n' + '='.repeat(60));
    console.log('✓ ALL DATA UPDATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`Completed at: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('✗ ERROR OCCURRED');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\nSQL Server connection closed.');
    }
  }
}

// Run the script
main();
