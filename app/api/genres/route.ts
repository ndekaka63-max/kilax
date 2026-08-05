import { NextResponse } from 'next/server';
import { getGenres } from '@/lib/api';

export async function GET() {
  try {
    const genres = await getGenres();
    return NextResponse.json({ genres: genres || [] });
  } catch (error) {
    console.error('Genres API error:', error);
    return NextResponse.json({ genres: [] }, { status: 500 });
  }
}