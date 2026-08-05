import { NextRequest, NextResponse } from 'next/server';

/**
 * Normalise a video URL so that path segments are properly percent-encoded
 * exactly once, regardless of whether the stored URL already has %20 or
 * literal spaces. This prevents the double-encoding bug (%2520) that occurs
 * when encodeURIComponent is applied to a URL that already contains %XX.
 */
function normalizeUpstreamUrl(raw: string): string {
  try {
    // Fully decode first so we start from a clean, unencoded state
    const decoded = decodeURIComponent(raw);
    const u = new URL(decoded);
    // Re-encode each path segment individually (encodeURIComponent encodes
    // spaces → %20 and other special chars, but leaves / intact via join)
    const encodedPath = u.pathname
      .split('/')
      .map(seg => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return `${u.protocol}//${u.host}${encodedPath}${u.search}`;
  } catch {
    return raw;
  }
}

function getMimeTypeFromUrl(urlString: string): string | null {
  try {
    const pathname = new URL(urlString).pathname.toLowerCase();

    if (pathname.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    if (pathname.endsWith('.mpd')) return 'application/dash+xml';
    if (pathname.endsWith('.webm')) return 'video/webm';
    if (pathname.endsWith('.mkv')) return 'video/x-matroska';
    if (pathname.endsWith('.mov')) return 'video/quicktime';
    if (pathname.endsWith('.mp4')) return 'video/mp4';
    if (pathname.endsWith('.m4v')) return 'video/mp4';
    if (pathname.endsWith('.avi')) return 'video/x-msvideo';
    if (pathname.endsWith('.flv')) return 'video/x-flv';
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');
    const filename = searchParams.get('filename');

    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }

    const fetchUrl = normalizeUpstreamUrl(videoUrl);

    const username = process.env.VIDEO_AUTH_USERNAME || process.env.CADDY_USERNAME || 'mat';
    const password = process.env.VIDEO_AUTH_PASSWORD || process.env.CADDY_PASSWORD || 'MatTh3pAR';
    const encodedCredentials = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');

    const range = request.headers.get('range');
    const upstreamHeaders: Record<string, string> = {
      'Authorization': `Basic ${encodedCredentials}`
    };

    if (range) {
      upstreamHeaders['Range'] = range;
    }

    const videoResponse = await fetch(fetchUrl, {
      headers: upstreamHeaders
    });

    if (!videoResponse.ok) {
      const responseText = await videoResponse.text().catch(() => '');
      console.error('Stream API: Upstream fetch failed', {
        url: fetchUrl,
        status: videoResponse.status,
        statusText: videoResponse.statusText,
        responseText
      });
      return NextResponse.json({
        error: 'Video fetch failed',
        status: videoResponse.status,
        statusText: videoResponse.statusText,
        responseText
      }, { status: videoResponse.status });
    }

    const contentType = videoResponse.headers.get('content-type') || getMimeTypeFromUrl(fetchUrl) || 'video/mp4';
    const contentLength = videoResponse.headers.get('content-length');
    const contentRange = videoResponse.headers.get('content-range');
    const acceptRanges = videoResponse.headers.get('accept-ranges');

    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length, Content-Type'
    });

    // Set proper filename for downloads
    if (filename) {
      // Sanitize filename and ensure it has proper extension
      let cleanFilename = filename.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();

      // If no extension, add .mp4 as default
      if (!cleanFilename.includes('.')) {
        cleanFilename += '.mp4';
      }

      responseHeaders.set('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    }

    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    if (acceptRanges) {
      responseHeaders.set('Accept-Ranges', acceptRanges);
    } else {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    console.log('Stream API: Proxying stream, status:', videoResponse.status);
    return new NextResponse(videoResponse.body, {
      status: videoResponse.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Stream API: Internal error', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length, Content-Type',
    },
  });
}