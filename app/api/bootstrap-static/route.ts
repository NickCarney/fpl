import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const pool = await getPool();

    // Fetch all data in parallel
    const [teamsResult, playersResult, eventsResult, elementTypesResult] = await Promise.all([
      pool.request().query('SELECT * FROM dbo.teams ORDER BY id'),
      pool.request().query('SELECT * FROM dbo.players ORDER BY id'),
      pool.request().query('SELECT * FROM dbo.events ORDER BY id'),
      pool.request().query('SELECT * FROM dbo.element_types ORDER BY id'),
    ]);

    // Construct bootstrap-static response matching FPL API structure
    const response = {
      teams: teamsResult.recordset,
      elements: playersResult.recordset,
      events: eventsResult.recordset,
      element_types: elementTypesResult.recordset,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Error fetching bootstrap-static:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bootstrap-static data' },
      { status: 500 }
    );
  }
}
