import { NextResponse } from 'next/server';
import { getVJs } from '@/lib/api';

export async function GET() {
  try {
    const vjs = await getVJs();
    return NextResponse.json({ vjs: vjs || [] });
  } catch (error) {
    console.error('VJs API error:', error);
    return NextResponse.json({ vjs: [] }, { status: 500 });
  }
}