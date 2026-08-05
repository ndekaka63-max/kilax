import { NextRequest, NextResponse } from 'next/server'

const REELPLEXI_API_KEY = (process.env.REELPLEXI_API_KEY || process.env.NEXT_PUBLIC_REELPLEXI_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
const REELPLEXI_BASE_URL = 'https://api.reelplexi.com'

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const searchParams = req.nextUrl.searchParams.toString()
  const url = `${REELPLEXI_BASE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`
  const hasApiKey = Boolean(REELPLEXI_API_KEY)

  try {
    console.log('Reelplexi API proxy request', {
      url,
      hasApiKey,
      keyLength: REELPLEXI_API_KEY.length
    })

    const res = await fetch(url, {
      headers: {
        'X-API-Key': REELPLEXI_API_KEY,
        'Authorization': `Bearer ${REELPLEXI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const contentType = res.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const data = await res.json()
      if (!res.ok) {
        console.error('Reelplexi API proxy failed with JSON response', {
          url,
          status: res.status,
          statusText: res.statusText,
          hasApiKey,
          data
        })
      }
      return NextResponse.json({
        ...data,
        _debug: {
          url,
          status: res.status,
          statusText: res.statusText,
          hasApiKey
        }
      }, { status: res.status })
    }

    const data = await res.text()
    if (!res.ok) {
      console.error('Reelplexi API proxy failed with text response', {
        url,
        status: res.status,
        statusText: res.statusText,
        hasApiKey,
        body: data
      })
    }
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': contentType
      }
    })
  } catch (error: any) {
    console.error('Reelplexi API proxy internal error', {
      url,
      hasApiKey,
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      error: 'Reelplexi proxy internal error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      _debug: {
        url,
        hasApiKey,
        keyLength: REELPLEXI_API_KEY.length
      }
    }, { status: 500 })
  }
}
