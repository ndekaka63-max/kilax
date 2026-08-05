import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMovieStream, getEpisodeStream } from '@/lib/api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('type')
    const contentId = searchParams.get('id')
    const episodeId = searchParams.get('episodeId')

    if (!contentType || !contentId) {
      return NextResponse.json({ error: 'Missing content parameters' }, { status: 400 })
    }

    if (contentType === 'movie') {
      const { data: movie, error } = await supabase
        .from('movies')
        .select('id, title, video_url, published, premium')
        .eq('id', contentId)
        .eq('published', true)
        .single()

      if (error || !movie) {
        return NextResponse.json({ error: 'Movie not found or not published' }, { status: 404 })
      }

      const reelplexiStream = await getMovieStream(movie.id)
      const streamUrl = reelplexiStream?.video_url || null

      if (!streamUrl) {
        return NextResponse.json({
          error: 'No Reelplexi stream URL available',
          hint: 'Set REELPLEXI_API_KEY in the deployment environment and ensure the movie has a Reelplexi stream endpoint.'
        }, { status: 500 })
      }

      return NextResponse.json({
        streamUrl,
        title: movie.title,
        source: reelplexiStream?.video_url ? 'reelplexi' : 'proxy'
      })
    }

    if (contentType === 'series') {
      if (!episodeId) {
        return NextResponse.json({ error: 'Episode ID required for series streaming' }, { status: 400 })
      }

      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          video_url,
          published,
          premium,
          episode_number,
          season_id
        `)
        .eq('id', episodeId)
        .eq('published', true)
        .single()

      if (episodeError || !episode) {
        return NextResponse.json({ error: 'Episode not found or not published' }, { status: 404 })
      }

      const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .select(`
          id,
          name,
          order,
          series_id
        `)
        .eq('id', episode.season_id)
        .single()

      if (seasonError || !season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 })
      }

      const seasonOrder = season.order || 1
      const seriesId = season.series_id || contentId
      const reelplexiStream = await getEpisodeStream(seriesId, seasonOrder, episode.episode_number)
      const streamUrl = reelplexiStream?.video_url || null

      if (!streamUrl) {
        return NextResponse.json({
          error: 'No Reelplexi stream URL available',
          hint: 'Set REELPLEXI_API_KEY in the deployment environment and ensure the episode has a Reelplexi stream endpoint.'
        }, { status: 500 })
      }

      return NextResponse.json({
        streamUrl,
        title: episode.title,
        source: reelplexiStream?.video_url ? 'reelplexi' : 'proxy'
      })
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
  } catch (error) {
    console.error('Content stream resolver failed', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({
      error: 'Failed to resolve stream URL',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}