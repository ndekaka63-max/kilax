import { Movie, Series, Episode } from './supabase'

const REELPLEXI_API_KEY = (process.env.REELPLEXI_API_KEY || process.env.NEXT_PUBLIC_REELPLEXI_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
const isServer = typeof window === 'undefined'
const REELPLEXI_BASE_URL = isServer ? 'https://api.reelplexi.com' : '/api/reelplexi'

class ReelplexiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ReelplexiError'
  }
}

async function fetchReelplexi(endpoint: string, params: Record<string, string | number> = {}) {
  let origin = ''
  if (!isServer) {
    origin = window.location.origin || (window.location.protocol + '//' + window.location.hostname + (window.location.port ? `:${window.location.port}` : ''))
  }

  const urlString = isServer ? `${REELPLEXI_BASE_URL}${endpoint}` : `${origin}${REELPLEXI_BASE_URL}${endpoint}`
  const queryString = Object.keys(params).length > 0
    ? `?${Object.keys(params).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`).join('&')}`
    : ''

  const fullUrl = `${urlString}${queryString}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (isServer && REELPLEXI_API_KEY) {
    headers['X-API-Key'] = REELPLEXI_API_KEY
    headers['Authorization'] = `Bearer ${REELPLEXI_API_KEY}`
  }

  let res: Response

  if (isServer) {
    res = await fetch(fullUrl, {
      headers,
      next: { revalidate: 300 }
    })
  } else {
    res = await new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', fullUrl, true)
        for (const key in headers) {
          if (Object.prototype.hasOwnProperty.call(headers, key)) {
            xhr.setRequestHeader(key, headers[key])
          }
        }
        xhr.onload = function() {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            text: async () => xhr.responseText,
            json: async () => {
              try {
                return JSON.parse(xhr.responseText)
              } catch {
                return {}
              }
            }
          } as Response)
        }
        xhr.onerror = function() {
          reject(new Error('Network request failed'))
        }
        xhr.send()
      } catch (error) {
        reject(error)
      }
    })
  }

  if (!res.ok) {
    const text = await res.text()
    console.error('Reelplexi request failed', {
      endpoint,
      fullUrl,
      status: res.status,
      responseText: text
    })
    throw new ReelplexiError(res.status, `HTTP error ${res.status}: ${text.substring(0, 150)}`)
  }

  return await res.json()
}

export async function getReelplexiMovieStream(id: string) {
  try {
    const res = await fetchReelplexi(`/v1/movies/${id}/stream`)
    const streamData = res.data || res
    const url = streamData.stream_url || streamData.video_url || streamData.proxy_url || streamData.url
    return {
      stream_url: url,
      proxy_url: streamData.proxy_url || url,
      video_url: url,
    }
  } catch (error) {
    console.error('Reelplexi: movie stream fetch failed', {
      id,
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return null
  }
}

export async function getReelplexiEpisodeStream(seriesId: string, season: number, episode: number) {
  try {
    const res = await fetchReelplexi(`/v1/series/${seriesId}/seasons/${season}/episodes/${episode}/stream`)
    const streamData = res.data || res
    const url = streamData.stream_url || streamData.video_url || streamData.proxy_url || streamData.url
    return {
      stream_url: url,
      proxy_url: streamData.proxy_url || url,
      video_url: url,
    }
  } catch (error) {
    console.error('Reelplexi: episode stream fetch failed', {
      seriesId,
      season,
      episode,
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return null
  }
}
