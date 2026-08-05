import * as Reelplexi from './reelplexi'

export interface ReelplexiMovie {
  id: string
  title: string
  name?: string
  overview?: string
  description?: string
  release_date?: string
  released_at?: string
  year?: number
  poster_url?: string
  poster_path?: string
  thumbnail_url?: string
  backdrop_url?: string
  backdrop_path?: string
  cover_image_url?: string
  embed_url?: string
  stream_url?: string
  proxy_url?: string
  video_url?: string
  genres?: string[]
  genre_ids?: string[]
  vj_name?: string
  vj?: string
  translator?: string
  vjs?: { name: string }
  available_vj_versions?: Array<{ vj_name?: string; name?: string }>
  published?: boolean
}

export interface ReelplexiSeries extends ReelplexiMovie {
  first_air_date?: string
  number_of_seasons?: number
  seasons?: number
}

export interface ReelplexiEpisode {
  id: string
  series_id?: string
  season_number: number
  episode_number: number
  title?: string
  name?: string
  overview?: string
  description?: string
  thumbnail_url?: string
  poster_url?: string
  poster_path?: string
  backdrop_url?: string
  backdrop_path?: string
  cover_image_url?: string
  video_url?: string
  stream_url?: string
  proxy_url?: string
  embed_url?: string
  published?: boolean
}

class ReelplexiServiceWrapper {
  async getMovies(page = 1, perPage = 50) {
    return Reelplexi.getReelplexiMovies(page, perPage)
  }

  async getSeries(page = 1, perPage = 50) {
    return Reelplexi.getReelplexiSeries(page, perPage)
  }

  async getTrendingMovies(page = 1, perPage = 20) {
    return Reelplexi.getReelplexiTrendingMovies(page, perPage)
  }

  async getTopMovies(page = 1, perPage = 20) {
    return Reelplexi.getReelplexiTrendingMovies(page, perPage)
  }

  async getGenres() {
    return Reelplexi.getReelplexiGenres()
  }

  async getMoviesByGenre(genre: string) {
    return Reelplexi.getReelplexiMoviesByGenre(genre)
  }

  async getSeriesByGenre(genre: string) {
    return Reelplexi.getReelplexiSeriesByGenre(genre)
  }

  async searchMovies(query: string, page = 1, perPage = 50) {
    return Reelplexi.searchReelplexiMovies(query, page, perPage)
  }

  async searchSeries(query: string, page = 1, perPage = 50) {
    return Reelplexi.searchReelplexiSeries(query, page, perPage)
  }

  async getRelatedMovies(id: string, page = 1, perPage = 20) {
    return Reelplexi.getReelplexiRelatedMoviesByGenre(id, page, perPage)
  }

  async getRelatedSeries(id: string, page = 1, perPage = 20) {
    return Reelplexi.getReelplexiRelatedSeriesByGenre(id, page, perPage)
  }

  async getMovieDownloadUrl(id: string) {
    return Reelplexi.getReelplexiMovieDownloadUrl(id)
  }

  async getEpisodeDownloadUrl(seriesId: string, season: number, episode: number) {
    return Reelplexi.getReelplexiEpisodeDownloadUrl(seriesId, season, episode)
  }

  // ---- Methods required by legacy sub-routes ----
  async getMovieById(id: string) {
    return Reelplexi.getReelplexiMovieById(id)
  }

  async getSeriesById(id: string) {
    return Reelplexi.getReelplexiSeriesById(id)
  }

  async getSeriesEpisodes(seriesId: string, season: number) {
    return Reelplexi.getReelplexiEpisodes(seriesId, season)
  }

  async getMovieStream(id: string) {
    return Reelplexi.getReelplexiMovieStream(id)
  }

  async getEpisodeStream(seriesId: string, season: number, episode: number) {
    return Reelplexi.getReelplexiEpisodeStream(seriesId, season, episode)
  }
}

const ReelplexiService = new ReelplexiServiceWrapper()
export default ReelplexiService

