import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        p.*,
        t.name as team_name,
        t.short_name as team_short_name,
        et.singular_name as position_singular,
        et.singular_name_short as position_short
      FROM dbo.players p
      LEFT JOIN dbo.teams t ON p.team = t.id
      LEFT JOIN dbo.element_types et ON p.element_type = et.id
      ORDER BY p.total_points DESC
    `);

    return NextResponse.json(result.recordset, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}
