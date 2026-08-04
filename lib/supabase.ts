import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

function createMissingSupabaseClient() {
  const missingError = new Error(
    'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_ANON_KEY, or the NEXT_PUBLIC_ equivalents.'
  )

  const createQueryProxy = (): any =>
    new Proxy(function () {}, {
      apply() {
        return createQueryProxy()
      },
      get(_target, property) {
        if (property === 'then') {
          return (_resolve: (value: unknown) => void, reject: (reason: Error) => void) => {
            reject(missingError)
          }
        }

        if (property === 'catch') {
          return (handler: (reason: Error) => unknown) => Promise.reject(missingError).catch(handler)
        }

        if (property === 'finally') {
          return (handler: () => unknown) => Promise.reject(missingError).finally(handler)
        }

        return createQueryProxy()
      }
    })

  return {
    from: () => createQueryProxy(),
    rpc: () => Promise.reject(missingError),
    auth: {
      async getSession() {
        return { data: { session: null }, error: missingError }
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {}
            }
          }
        }
      },
      async signInWithPassword() {
        return { data: null, error: missingError }
      },
      async signUp() {
        return { data: null, error: missingError }
      },
      async signInWithOAuth() {
        return { data: null, error: missingError }
      },
      async signOut() {
        return { error: missingError }
      },
      async resetPasswordForEmail() {
        return { data: null, error: missingError }
      },
      async updateUser() {
        return { data: null, error: missingError }
      },
      async refreshSession() {
        return { data: { session: null }, error: missingError }
      },
      async getUser() {
        return { data: { user: null }, error: missingError }
      }
    }
  } as unknown as ReturnType<typeof createClient>
}

if (!hasSupabaseConfig) {
  console.warn('Supabase environment variables are missing; using a safe fallback client.')
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : createMissingSupabaseClient()

// Database Types
export interface Genre {
  id: string
  name: string
  description?: string
  tmdb_id?: number
}

export interface Movie {
  id: string
  title: string
  description?: string
  release_date?: string
  cover_image_url?: string
  trailer_url?: string
  genre_ids?: string[]
  duration?: number
  published: boolean
  premium: boolean
  created_at: string
  recommend: boolean
  popular: boolean
  latest: boolean
  vj_id?: string
  videolink_url?: string
  video_url?: string
  thumbnail_url?: string
  tmdb_id?: number
}

export interface Series {
  id: string
  title: string
  description?: string
  release_date?: string
  cover_image_url?: string
  created_at: string
  vj_id?: string
  genre_ids?: string[]
  published: boolean
  thumbnail_url?: string
  trailer_url?: string
  tmdb_id?: number
  seasons?: Season[]
}

export interface Season {
  id: string
  series_id: string
  name: string
  order: number
  published: boolean
  created_at: string
  episode_count?: number
  overview?: string
  episodes?: Episode[]
}

export interface Episode {
  id: string
  season_id: string
  title: string
  episode_number: number
  video_url?: string
  videolink_url?: string
  published: boolean
  premium: boolean
  duration?: number
  thumbnail_url?: string
  created_at: string
}

// Extended Episode type with season information for UI display
export interface EpisodeWithSeason extends Episode {
  seasonName: string
  seasonOrder: number
}

export interface VJ {
  id: string
  name: string
  // Add other VJ fields as needed
}

export interface Subscription {
  id: number
  user_id: string
  plan: string
  payment_method: string
  subscribed_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  amount: number
  description: string | null
  duration: string | null
  duration_in_months: number | null
  duration_in_days: number | null
}

// Extended Movie type with VJ relation for queries that join VJ data
export interface MovieWithVJ extends Movie {
  vjs?: {
    name: string
  }
}

// Extended Series type with VJ relation for queries that join VJ data
export interface SeriesWithVJ extends Series {
  vjs?: {
    name: string
  }
}