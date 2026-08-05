import { NextRequest, NextResponse } from 'next/server'

const REELPLEXI_API_KEY = (process.env.REELPLEXI_API_KEY || process.env.NEXT_PUBLIC_REELPLEXI_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
const REELPLEXI_BASE_URL = 'https://api.reelplexi.com'

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  const searchParams = req.nextUrl.searchParams.toString()
  const url = `${REELPLEXI_BASE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`

  try {
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
          data
        })
      }
      return NextResponse.json(data, { status: res.status })
    }

    const data = await res.text()
    if (!res.ok) {
      console.error('Reelplexi API proxy failed with text response', {
        url,
        status: res.status,
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
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
