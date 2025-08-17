import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    
    const response = await fetch(
      `https://fantasy.premierleague.com/api/element-summary/${playerId}/`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch player gameweek data');
    }
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching player gameweek data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player gameweek data' },
      { status: 500 }
    );
  }
}
