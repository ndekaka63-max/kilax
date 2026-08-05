import * as Reelplexi from './reelplexi'
import { getMovies, getSeries, getVJContent, getGenreRowsForHome, searchMovies, searchSeries, getVJs, getMovieById, getSeriesById, getMovieStream, getEpisodeStream } from './api'

export async function getMoviesClient(page = 1, limit = 50) {
  try {
    const data = await getMovies(limit, page)
    return { data, hasMore: data.length >= limit }
  } catch (error) {
    console.error('Error fetching movies:', error)
    return { data: [], hasMore: false }
  }
}

export async function getSeriesClient(page = 1, limit = 50) {
  try {
    const data = await getSeries(limit, page)
    return { data, hasMore: data.length >= limit }
  } catch (error) {
    console.error('Error fetching series:', error)
    return { data: [], hasMore: false }
  }
}

export async function getVJContentClient(limit = 12) {
  try {
    return await getVJContent(limit)
  } catch (error) {
    console.error('Error fetching VJ content:', error)
    return []
  }
}

export async function getKilaxExclusiveContentClient(limit = 12) {
  try {
    const movies = await getMovies(limit / 2)
    const series = await getSeries(limit / 2)
    const combined = [
      ...movies.map((item: any) => ({ ...item, type: 'movie' as const })),
      ...series.map((item: any) => ({ ...item, type: 'series' as const })),
    ]
    return combined.sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ).slice(0, limit)
  } catch (error) {
    console.error('Error fetching exclusive content:', error)
    return []
  }
}

export async function getGenreRowsClient(limit = 12) {
  try {
    return await getGenreRowsForHome(limit)
  } catch (error) {
    console.error('Error fetching genre rows:', error)
    return []
  }
}

export async function searchMoviesClient(query: string) {
  try {
    return await searchMovies(query)
  } catch (error) {
    console.error('Error searching movies:', error)
    return []
  }
}

export async function searchSeriesClient(query: string) {
  try {
    return await searchSeries(query)
  } catch (error) {
    console.error('Error searching series:', error)
    return []
  }
}

export async function getVJsClient() {
  try {
    return await getVJs()
  } catch (error) {
    console.error('Error fetching VJs:', error)
    return []
  }
}

export async function getMoviesByVJClient(vjId: string, vjName: string) {
  try {
    return await Reelplexi.searchReelplexiMovies('', 1, 50, vjName)
  } catch (error) {
    console.error('Error fetching movies by VJ:', error)
    return []
  }
}

export async function getSeriesByVJClient(vjId: string, vjName: string) {
  try {
    return await Reelplexi.searchReelplexiSeries('', 1, 50, vjName)
  } catch (error) {
    console.error('Error fetching series by VJ:', error)
    return []
  }
}

export async function getMovieByIdClient(id: string) {
  try {
    return await getMovieById(id)
  } catch (error) {
    console.error('Error fetching movie:', error)
    return null
  }
}

export async function getSeriesByIdClient(id: string, season?: number) {
  try {
    return await getSeriesById(id)
  } catch (error) {
    console.error('Error fetching series:', error)
    return null
  }
}

export async function getStreamUrlClient(id: string, type: 'movie' | 'episode', season?: number, episode?: number) {
  try {
    if (type === 'movie') {
      const stream = await getMovieStream(id)
      return stream?.video_url || null
    } else if (season !== undefined && episode !== undefined) {
      const stream = await getEpisodeStream(id, season, episode)
      return stream?.video_url || null
    }
    return null
  } catch (error) {
    console.error('Error fetching stream URL:', error)
    return null
  }
}
