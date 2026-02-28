import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
