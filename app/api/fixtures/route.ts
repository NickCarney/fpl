import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const event = searchParams.get('event');

    const pool = await getPool();
    const queryRequest = pool.request();

    let query = `
      SELECT
        f.*,
        ta.name as team_a_name,
        ta.short_name as team_a_short_name,
        th.name as team_h_name,
        th.short_name as team_h_short_name,
        e.name as event_name
      FROM dbo.fixtures f
      LEFT JOIN dbo.teams ta ON f.team_a = ta.id
      LEFT JOIN dbo.teams th ON f.team_h = th.id
      LEFT JOIN dbo.events e ON f.event = e.id
    `;

    if (event) {
      queryRequest.input('event', event);
      query += ' WHERE f.event = @event';
    }

    query += ' ORDER BY f.kickoff_time ASC';

    const result = await queryRequest.query(query);

    return NextResponse.json(result.recordset, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}
