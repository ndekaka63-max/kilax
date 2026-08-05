import { NextRequest, NextResponse } from 'next/server';
import {
  getReelplexiMovieDownloadUrl,
  getReelplexiEpisodeDownloadUrl,
} from '@/lib/reelplexi';

/**
 * Download route that fetches a presigned download URL from the backend
 * and redirects the user to it.
 *
 * iOS Safari Handling:
 * - iOS doesn't respect Content-Disposition headers from redirects
 * - Instead, we return the URL in JSON for client-side handling
 * - Client should use <a download> or show instructions
 *
 * Two modes:
 *
 * 1. Direct redirect (url already known):
 *    ?url=<signed-url>
 *    Redirects to the provided URL (or JSON for iOS).
 *
 * 2. Reelplexi lookup:
 *    ?id=<id>&type=movie|episode&season=<n>&episode=<n>
 *    Resolves the dedicated download URL from Reelplexi server-side, then redirects.
 */
export async function GET(req: NextRequest) {
  // Detect iOS devices
  const userAgent = req.headers.get('user-agent') || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  const isIOSSafari = isIOS && isSafari;

  const url = req.nextUrl.searchParams.get('url');

  // Mode 1: Direct redirect — url is already known
  if (url) {
    // For iOS Safari, return JSON with instructions
    if (isIOSSafari) {
      return NextResponse.json({
        downloadUrl: url,
        platform: 'ios',
        instructions: 'Long-press the download link and select "Download Linked File"',
      });
    }
    return NextResponse.redirect(url);
  }

  // Mode 2: Resolve URL from Reelplexi server-side
  const id = req.nextUrl.searchParams.get('id');
  const type = req.nextUrl.searchParams.get('type') || 'movie';
  const season = req.nextUrl.searchParams.get('season');
  const episode = req.nextUrl.searchParams.get('episode');
  const filename = req.nextUrl.searchParams.get('filename');

  if (!id) {
    return NextResponse.json({ error: 'Either url or id is required' }, { status: 400 });
  }

  try {
    let resolvedUrl: string | null = null;

    if (type === 'movie') {
      try {
        resolvedUrl = await getReelplexiMovieDownloadUrl(id);
      } catch (e: any) {
        return NextResponse.json({ error: 'Failed to get movie download url', details: e.message }, { status: 500 });
      }
    } else if (type === 'episode' && season && episode) {
      try {
        resolvedUrl = await getReelplexiEpisodeDownloadUrl(
          id,
          parseInt(season, 10),
          parseInt(episode, 10)
        );
      } catch (e: any) {
         return NextResponse.json({ error: 'Failed to get episode download url', details: e.message }, { status: 500 });
      }
    }

    if (!resolvedUrl) {
      return NextResponse.json({ error: 'Download URL not available, resolvedUrl was null' }, { status: 404 });
    }

    // For iOS Safari, return JSON with download info
    if (isIOSSafari) {
      return NextResponse.json({
        downloadUrl: resolvedUrl,
        filename: filename || 'video.mp4',
        platform: 'ios',
        instructions: 'Tap the download button below, then long-press and select "Download Linked File"',
      });
    }

    // For other browsers, redirect directly to the Wasabi presigned URL
    return NextResponse.redirect(resolvedUrl);
  } catch (error: any) {
    console.error('[Download API] Reelplexi lookup error:', error);
    return NextResponse.json({ error: 'Failed to resolve download URL', details: error.message }, { status: 500 });
  }
}
