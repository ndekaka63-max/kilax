"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FullPageSpinner, InlineSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Play, Download, ChevronLeft, ChevronRight } from "lucide-react";
import InlinePlayer from "@/components/InlinePlayer";
import { useAuth } from "@/components/AuthProvider";
import { setRedirectCookie } from "@/lib/utils";
import { getProfile, Profile } from '@/lib/profiles';
import AuthRequiredModal, { useAuthCheck } from '@/components/AuthRequiredModal';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import { isStandardPremium } from "@/lib/isStandardPremium";

import { Series, SeriesWithVJ, Season, Episode, EpisodeWithSeason } from "@/lib/supabase";
// Netflix-style card component (inlined from homepage)
import type { MovieWithVJ } from "@/lib/supabase";
type NetflixContent = MovieWithVJ | SeriesWithVJ;
const NetflixCard = ({ content, type }: { content: NetflixContent; type: 'movie' | 'series' }) => (
  <div className="group">
    <Link href={`/${type === 'movie' ? 'movies' : 'series'}/${content.id}`}>
      <div className="cursor-pointer transition-transform duration-300 hover:scale-105">
        <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-gray-800 mb-3">
          <Image
            src={content.thumbnail_url || content.cover_image_url || `https://via.placeholder.com/300x450/1f2937/f97316?text=${encodeURIComponent(content.title)}`}
            alt={content.title}
            fill
            className="object-cover transition-opacity duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://via.placeholder.com/300x450/1f2937/f97316?text=${encodeURIComponent(content.title)}`;
            }}
          />
          {/* Content type badge */}
          <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
            type === 'movie' ? 'bg-[#FF7F50]' : 'bg-[#1ABC9C]'
          }`}>
            {type === 'movie' ? 'Movie' : 'Series'}
          </div>
          {/* Description overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f97316]/80 via-[#f97316]/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
            <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
              {content.description || "An amazing piece of entertainment that will keep you on the edge of your seat."}
            </p>
          </div>
        </div>
      </div>
    </Link>
    {/* Content info outside the card */}
    <div className="mt-1">
      <h3 className="font-semibold text-white text-sm truncate">{content.title}</h3>
      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
        {content.release_date && (
          <span>{new Date(content.release_date).getFullYear()}</span>
        )}
        {'duration' in content && content.duration && (
          <>
            <span>•</span>
            <span>{content.duration}m</span>
          </>
        )}
      </div>
    </div>
  </div>
);

import { supabase } from "@/lib/supabase";

import { getRelatedMoviesByGenre } from '@/lib/api';

export default function SeriesDetailsPage() {
  const params = useParams();
  const { user, isPremium, loading: authLoading } = useAuth();
  const { checkAuth } = useAuthCheck();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedSeries, setRelatedSeries] = useState<SeriesWithVJ[]>([]);
  const [relatedMovies, setRelatedMovies] = useState<MovieWithVJ[]>([]);
  const [genres, setGenres] = useState<{ id: string; name: string }[]>([]);
  const [vj, setVj] = useState<{ id: string; name: string } | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeWithSeason | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [episodesPerPage] = useState(12); // Show 12 episodes per page
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isStandardPremiumUser, setIsStandardPremiumUser] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      getProfile(user.id).then(setProfile);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      if (!user) { setIsStandardPremiumUser(false); return; }
      const subscription = await (await import("@/lib/subscriptions")).getUserSubscription(user.id);
      setIsStandardPremiumUser(isStandardPremium(subscription));
    })();
  }, [user]);

  useEffect(() => {
    async function fetchSeries() {
      if (!params.id) {
        console.error('No series ID provided');
        return;
      }

      console.log('Environment check:', {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
      });

      // Check what series are available
      console.log('Checking available series...');
      const { data: allSeries, error: allSeriesError } = await supabase
        .from('series')
        .select('id, title, published')
        .limit(10);

      console.log('Available series:', { data: allSeries, error: allSeriesError });

      // Test basic Supabase connection
      console.log('Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('series')
        .select('count')
        .limit(1);

      console.log('Supabase connection test:', { data: testData, error: testError });

      // Check if seasons table exists
      console.log('Checking if seasons table exists...');
      try {
        const { data: seasonsTest, error: seasonsTestError } = await supabase
          .from('seasons')
          .select('id')
          .limit(1);

        console.log('Seasons table test:', { data: seasonsTest, error: seasonsTestError });
      } catch (tableError) {
        console.error('Seasons table does not exist or is not accessible:', tableError);
      }

      try {
        // First, check if the series exists with a simple query
        console.log('Checking if series exists with simple query...');
        const { data: simpleCheck, error: simpleError } = await supabase
          .from('series')
          .select('id, title, published')
          .eq('id', params.id)
          .single();

        console.log('Simple series check:', { data: simpleCheck, error: simpleError });

        if (simpleError) {
          console.error('Series does not exist or simple query failed:', simpleError);
          throw new Error(`Series not found: ${simpleError.message}`);
        }

        if (!simpleCheck.published) {
          console.error('Series exists but is not published:', simpleCheck);
          throw new Error('Series is not published');
        }

        // Fetch series details with seasons and episodes
        console.log('Fetching series with ID:', params.id);
        const { data: seriesData, error } = await supabase
          .from('series')
          .select(`
            *,
            vjs:vj_id (
              id,
              name
            )
          `)
          .eq('id', params.id)
          .single();

        console.log('Series query result:', { data: seriesData, error });

        if (error) {
          console.error('Supabase error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }

        // Fetch seasons and episodes with improved error handling
        console.log('Fetching seasons for series:', params.id);

        // First, try to fetch seasons only
        const { data: seasonsOnly, error: seasonsOnlyError } = await supabase
          .from('seasons')
          .select('*')
          .eq('series_id', params.id)
          .eq('published', true)
          .order('order', { ascending: true });

        console.log('Seasons only query:', { data: seasonsOnly, error: seasonsOnlyError });

        if (seasonsOnlyError) {
          console.error('Error fetching seasons (basic):', seasonsOnlyError);
          seriesData.seasons = [];
        } else if (seasonsOnly && seasonsOnly.length > 0) {
          // If seasons exist, fetch episodes for each season
          console.log('Found seasons, fetching episodes...');

          const seasonsWithEpisodes = await Promise.all(
            seasonsOnly.map(async (season) => {
              try {
                const { data: episodes, error: episodesError } = await supabase
                  .from('episodes')
                  .select('*')
                  .eq('season_id', season.id)
                  .eq('published', true)
                  .order('episode_number', { ascending: true });

                if (episodesError) {
                  console.error(`Error fetching episodes for season ${season.id}:`, episodesError);
                  return { ...season, episodes: [] };
                }

                return { ...season, episodes: episodes || [] };
              } catch (error) {
                console.error(`Exception fetching episodes for season ${season.id}:`, error);
                return { ...season, episodes: [] };
              }
            })
          );

          seriesData.seasons = seasonsWithEpisodes;
          console.log('Seasons with episodes:', seasonsWithEpisodes);
        } else {
          console.log('No seasons found for this series');
          seriesData.seasons = [];
        }
        setSeries(seriesData);
        setLoading(false); // Hide skeleton as soon as main series data is ready

        // Store seasons data
        if (seriesData.seasons) {
          console.log('Seasons data:', seriesData.seasons);
          setSeasons(seriesData.seasons);

          // Set first available episode as selected with proper EpisodeWithSeason type
          let firstAvailableEpisode: EpisodeWithSeason | null = null;

          for (const season of seriesData.seasons) {
            if (season.published && season.episodes && season.episodes.length > 0) {
              console.log(`Checking season ${season.name || season.order} with ${season.episodes.length} episodes`);

              const availableEpisode = season.episodes.find((e: Episode) =>
                e.published && (e.video_url || e.videolink_url)
              );

              if (availableEpisode) {
                console.log('Found available episode:', availableEpisode);
                firstAvailableEpisode = {
                  ...availableEpisode,
                  seasonName: season.name || `Season ${season.order}`,
                  seasonOrder: season.order
                };
                break; // Stop at first available episode
              }
            }
          }

          if (firstAvailableEpisode) {
            console.log('Setting first available episode as selected:', firstAvailableEpisode);
            setSelectedEpisode(firstAvailableEpisode);
          } else {
            console.log('No available episodes found for auto-selection');
          }
        } else {
          console.log('No seasons data available');
        }

        // Fetch genres
        if (seriesData?.genre_ids && seriesData.genre_ids.length > 0) {
          const { data: genreData } = await supabase
            .from('genres')
            .select('*')
            .in('id', seriesData.genre_ids);
          setGenres(genreData || []);
        }

        // Fetch VJ
        if (seriesData?.vj_id) {
          const { data: vjData } = await supabase
            .from('vjs')
            .select('*')
            .eq('id', seriesData.vj_id)
            .single();
          setVj(vjData);
        }

        // Fetch related series by genre
        if (seriesData?.genre_ids && seriesData.genre_ids.length > 0) {
          const { data: related } = await supabase
            .from('series')
            .select('*, vjs(name)')
            .eq('published', true)
            .neq('id', params.id)
            .overlaps('genre_ids', seriesData.genre_ids)
            .order('created_at', { ascending: false })
            .limit(10);
          
          setRelatedSeries(related || []);

          // Fetch related movies by genre
          try {
            console.log('Fetching related movies for genres:', seriesData.genre_ids);
            const relatedMoviesData = await getRelatedMoviesByGenre(params.id as string, seriesData.genre_ids as string[], 10) as MovieWithVJ[];
            console.log('Related movies result:', relatedMoviesData);
            setRelatedMovies(relatedMoviesData || []);
          } catch (relatedError) {
            console.error('Error fetching related movies:', relatedError);
            setRelatedMovies([]);
          }
        }
      } catch (error) {
        console.error('Error fetching series:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
          params: params.id
        });
        // Don&apos;t throw the error, just log it and continue with empty state
      } finally {
        // Loading is already set to false when series data is available
      }
    }

    fetchSeries();
  }, [params.id]);

  // Handle episode selection
  const handleEpisodeSelect = (episode: EpisodeWithSeason) => {
    console.log('Episode selected:', {
      id: episode.id,
      title: episode.title,
      seasonName: episode.seasonName,
      video_url: episode.video_url,
      videolink_url: episode.videolink_url,
      published: episode.published
    });
    setSelectedEpisode(episode);
  };

  // Get all episodes from all seasons
  const getAllEpisodes = (): EpisodeWithSeason[] => {
    const allEpisodes: EpisodeWithSeason[] = [];
    seasons.forEach(season => {
      if (season.published && season.episodes) {
        season.episodes.forEach(episode => {
          if (episode.published) {
            allEpisodes.push({
              ...episode,
              seasonName: season.name || `Season ${season.order}`,
              seasonOrder: season.order
            });
          }
        });
      }
    });
    return allEpisodes.sort((a, b) => {
      if (a.seasonOrder !== b.seasonOrder) {
        return a.seasonOrder - b.seasonOrder;
      }
      return a.episode_number - b.episode_number;
    });
  };

  // Pagination logic
  const allEpisodes = getAllEpisodes();
  const totalPages = Math.ceil(allEpisodes.length / episodesPerPage);
  const startIndex = (currentPage - 1) * episodesPerPage;
  const endIndex = startIndex + episodesPerPage;
  const currentEpisodes = allEpisodes.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedEpisode(null); // Clear selection when changing pages
  };

  // Handle watch functionality with episode-level premium restrictions
  const handleWatch = async () => {
    console.log('Watch button clicked, selectedEpisode:', selectedEpisode);

    if (!selectedEpisode) {
      console.error('No episode selected');
      alert('Please select an episode to watch');
      return;
    }

    // Check authentication first
    if (!user?.id) {
      setAuthAction('play');
      setShowAuthModal(true);
      return;
    }

    // Check if episode requires premium and user doesn't have it
    if (selectedEpisode.premium && !isPremium) {
      // Show premium upgrade modal instead of auth modal
      setShowPremiumUpgradeModal(true);
      return;
    }

    if (!selectedEpisode.video_url) {
      console.error('Selected episode has no video_url:', selectedEpisode);
      alert('This episode is not available for watching');
      return;
    }

    console.log('Navigating to player with series ID:', params.id, 'episode ID:', selectedEpisode.id);
    // Navigate to the player page with correct series ID and episode ID
    window.location.href = `/player?id=${params.id}&type=series&episodeId=${selectedEpisode.id}`;
  };

  // Handle download functionality with episode-level premium restrictions
  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPremiumUpgradeModal, setShowPremiumUpgradeModal] = useState(false);
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<'play' | 'download'>('play');

  const handleDownload = async () => {
    if (!selectedEpisode) {
      alert('No episode selected');
      return;
    }

    // Check authentication first
    if (!user?.id) {
      setAuthAction('download');
      setShowAuthModal(true);
      return;
    }

    // Check if episode requires premium and user doesn't have it
    if (selectedEpisode.premium && !isPremium) {
      // Show premium upgrade modal instead of auth modal
      setShowPremiumUpgradeModal(true);
      return;
    }

    // Check if user has standard premium (downloads require standard premium)
    const subscription = await (await import("@/lib/subscriptions")).getUserSubscription(user.id);
    const hasStandardPremium = isStandardPremium(subscription);

    if (!hasStandardPremium) {
      // Show premium upgrade modal instead of auth modal
      setShowPremiumUpgradeModal(true);
      return;
    }
    
    // For standard premium users, show the download modal
    setShowDownloadModal(true);
  };

  // Download action for modal
  const handleDownloadNow = async () => {
    if (!selectedEpisode) return;
    const downloadUrl = selectedEpisode.videolink_url || selectedEpisode.video_url;
    if (!downloadUrl) return;
    let processedUrl = downloadUrl;
    if (processedUrl.startsWith('encrypted://') || processedUrl.startsWith('auth://')) {
      const urlPath = processedUrl.split('://')[1];
      const username = process.env.NEXT_PUBLIC_CADDY_USERNAME || "mat";
      const password = process.env.NEXT_PUBLIC_CADDY_PASSWORD || "MatTh3pAR";
      processedUrl = `https://${username}:${password}@${urlPath}`;
    }
    if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
      const cleanSeriesTitle = series?.title.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim() || 'Series';
      const cleanEpisodeTitle = selectedEpisode.title.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
      const filename = `${cleanSeriesTitle} - S${selectedEpisode.seasonOrder}E${selectedEpisode.episode_number} - ${cleanEpisodeTitle}.mp4`;
      processedUrl = `/api/stream?url=${encodeURIComponent(processedUrl)}&filename=${encodeURIComponent(filename)}`;
    }
    // Create a hidden anchor and click it for direct download
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `${series?.title || 'Series'} - S${selectedEpisode.seasonOrder}E${selectedEpisode.episode_number} - ${selectedEpisode.title}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowDownloadModal(false);
  };


  if (loading) {
    return <FullPageSpinner text="Loading series details..." />;
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Series Not Found</h1>
          <Link href="/">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Main Content - Inline Player */}
      <InlinePlayer
        title={series.title}
        subtitle={selectedEpisode ? `${selectedEpisode.seasonName} - Episode ${selectedEpisode.episode_number}: ${selectedEpisode.title}` : undefined}
        description={series.description || "An captivating series that delivers compelling storytelling across multiple episodes and seasons with rich character development."}
        year={series.release_date ? new Date(series.release_date).getFullYear().toString() : ''}
        vj={vj?.name || "MARK"}
        genres={genres.length > 0 ? genres.map(g => g.name) : ["Drama"]}
        coverImage={series.cover_image_url || `https://via.placeholder.com/300x450/1f2937/f97316?text=${encodeURIComponent(series.title)}`}
        selectedEpisode={selectedEpisode}
        onWatch={handleWatch}

        onDownload={handleDownload}
        primaryColor="#f97316"
        subscriptionPlan={profile?.subscription || null}
      />

      {/* Download Modal for Standard Premium Users */}
      {showDownloadModal && selectedEpisode && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-gray-900 p-8 rounded-xl border border-orange-400 shadow-xl max-w-sm w-full text-center">
            <h2 className="text-2xl font-bold mb-3 text-orange-400">Download Episode</h2>
            <p className="mb-6 text-gray-200 font-semibold">{series?.title} - S{selectedEpisode.seasonOrder}E{selectedEpisode.episode_number}: {selectedEpisode.title}</p>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 mb-3"
              onClick={handleDownloadNow}
              disabled={!selectedEpisode.video_url && !selectedEpisode.videolink_url}
            >
              {selectedEpisode.video_url || selectedEpisode.videolink_url ? (
                <>Download Now</>
              ) : (
                <span className="text-gray-400">No download available.</span>
              )}
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setShowDownloadModal(false)}>Close</Button>
          </div>
        </div>
      )}

      {/* Unified Authentication Modal */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action={authAction}
        requirePremium={Boolean(selectedEpisode?.premium)}
        customMessage={selectedEpisode?.premium ? 
          `This episode requires a premium subscription to ${authAction}.` : 
          undefined
        }
      />
      {/* Episode Grid or No Episodes Message */}
      {allEpisodes.length > 0 ? (
        <div className="container mx-auto px-6 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Episodes ({allEpisodes.length})</h2>
            {selectedEpisode && (
              <div className="text-sm text-gray-400">
                Selected: {selectedEpisode.seasonName} - Episode {selectedEpisode.episode_number}
              </div>
            )}
          
          </div>

          {/* Episode Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
            {currentEpisodes.map((episode: EpisodeWithSeason) => (
              <div
                key={episode.id}
                className={`group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 ${
                  selectedEpisode?.id === episode.id
                    ? 'ring-2 ring-orange-500 bg-gray-700'
                    : 'hover:bg-gray-700'
                }`}
                onClick={() => handleEpisodeSelect(episode)}
              >
                {/* Episode Thumbnail/Poster */}
                <div className="aspect-video bg-gray-900 relative">
                  <Image
                    src={episode.thumbnail_url || series.cover_image_url || `https://via.placeholder.com/300x169/1f2937/f97316?text=E${episode.episode_number}`}
                    alt={`Episode ${episode.episode_number}: ${episode.title}`}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://via.placeholder.com/300x169/1f2937/f97316?text=E${episode.episode_number}`;
                    }}
                  />

                  {/* Play Overlay - Always visible on mobile, hover on desktop */}
                  <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEpisodeSelect(episode);
                          
                          // Check authentication first
                          if (!user?.id) {
                            setAuthAction('play');
                            setShowAuthModal(true);
                            return;
                          }

                          // Check if episode requires premium and user doesn't have it
                          if (episode.premium && !isPremium) {
                            setShowPremiumUpgradeModal(true);
                            return;
                          }
                          
                          // Navigate directly to player with this episode
                          if (!episode.video_url) {
                            alert('This episode is not available for watching');
                            return;
                          }
                          
                          console.log('Navigating to player with series ID:', params.id, 'episode ID:', episode.id);
                          window.location.href = `/player?id=${params.id}&type=series&episodeId=${episode.id}`;
                        }}
                        className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full transition-colors shadow-lg"
                        title="Play Episode"
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                      {(() => {
                          // Import isStandardPremium inline (avoid circular import issues)
                          const isStandardPremium = (sub: string | null | undefined) => {
                            if (!sub) return false;
                            const plan = sub.toLowerCase().replace(/[_ ]/g, '');
                            return plan === 'standard' || plan === 'standardpremium';
                          };
                          if (isStandardPremium(profile?.subscription)) {
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEpisodeSelect(episode);
                                  
                                  // Check authentication first
                                  if (!user?.id) {
                                    setAuthAction('download');
                                    setShowAuthModal(true);
                                    return;
                                  }

                                  // Check if episode requires premium and user doesn't have it
                                  if (episode.premium && !isPremium) {
                                    setShowPremiumUpgradeModal(true);
                                    return;
                                  }
                                  
                                  handleDownload();
                                }}
                                className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-full transition-colors shadow-lg"
                                title="Download Episode"
                              >
                                <Download size={16} />
                              </button>
                            );
                          } else {
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEpisodeSelect(episode);
                                  handleDownload();
                                }}
                                className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-full transition-colors shadow-lg"
                                title="Download Episode"
                              >
                                <Download size={16} />
                              </button>
                            );
                          }
                        })()}

                    </div>
                  </div>

                  {/* Episode Number Badge */}
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">
                    E{episode.episode_number}
                  </div>

                  {/* Premium Badge */}
                  {episode.premium && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-black px-2 py-1 rounded text-xs font-bold">
                      PREMIUM
                    </div>
                  )}

                  {/* Lock Overlay for Premium Episodes without Access */}
                  {episode.premium && !isPremium && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="bg-orange-500 rounded-full p-2">
                        <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Duration */}
                  {episode.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      {episode.duration}m
                    </div>
                  )}
                </div>

                {/* Episode Info */}
                <div className="p-3">
                  <h4 className="font-semibold text-white text-sm mb-1 truncate">
                    {episode.title}
                  </h4>
                  <p className="text-gray-400 text-xs mb-2">
                    {episode.seasonName}
                  </p>

                  {/* Availability Indicator */}
                  {episode.video_url && (
                    <div className="flex items-center gap-1">
                      {episode.premium && !isPremium ? (
                        <>
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="text-orange-400 text-xs">Premium Required</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-green-400 text-xs">Available</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
              </button>

              {/* Page Numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  return page === 1 ||
                         page === totalPages ||
                         (page >= currentPage - 1 && page <= currentPage + 1);
                })
                .map((page, index, array) => (
                  <div key={page} className="flex items-center">
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* Page Info */}
          {totalPages > 1 && (
            <div className="text-center text-sm text-gray-400 mt-4">
              Showing {startIndex + 1}-{Math.min(endIndex, allEpisodes.length)} of {allEpisodes.length} episodes
            </div>
          )}
        </div>
      ) : (
        // No episodes available message
        <div className="container mx-auto px-6 mt-8">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold mb-4">Episodes Not Available</h2>
            <p className="text-gray-400 mb-4">
              This series doesn&apos;t have episode data available yet. Episodes may be added in the future.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/">
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Related Series */}
      {relatedSeries.length > 0 && (
        <div className="container mx-auto px-6 mt-16">
          <h2 className="text-2xl font-bold mb-6">Related Series</h2>
          <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
            {relatedSeries.map((relatedShow) => (
              <div key={relatedShow.id} className="flex-shrink-0" style={{width: '150px'}}>
                <div className="group">
                  <Link href={`/series/${relatedShow.id}`}>
                    <div className="cursor-pointer transition-transform duration-300 hover:scale-105">
                      <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-gray-800 mb-3">
                        <Image
                          src={relatedShow.thumbnail_url || relatedShow.cover_image_url || `https://via.placeholder.com/300x450/1f2937/f97316?text=${encodeURIComponent(relatedShow.title)}`}
                          alt={relatedShow.title}
                          fill
                          className="object-cover transition-opacity duration-300"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `https://via.placeholder.com/300x450/1f2937/f97316?text=${encodeURIComponent(relatedShow.title)}`;
                          }}
                        />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold bg-[#1ABC9C]">
                          Series
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1ABC9C]/80 via-[#1ABC9C]/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                          <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                            {relatedShow.description || "An amazing series that will keep you entertained with compelling storytelling."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-1">
                    <h3 className="font-semibold text-white text-sm truncate">{relatedShow.title}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      {relatedShow.release_date && (
                        <span>{new Date(relatedShow.release_date).getFullYear()}</span>
                      )}
                      <span className="text-orange-400">{relatedShow.vjs?.name || "MARK"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Movies */}
      {relatedMovies.length > 0 && (
        <div className="container mx-auto px-6 mt-12">
          <h2 className="text-2xl font-bold mb-6">Related Movies</h2>
          <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
            {relatedMovies.map((relatedMovie) => (
              <div key={relatedMovie.id} className="flex-shrink-0" style={{width: '150px'}}>
                <NetflixCard content={relatedMovie} type="movie" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Premium Upgrade Modal */}
      <PremiumUpgradeModal
        isOpen={showPremiumUpgradeModal}
        onClose={() => setShowPremiumUpgradeModal(false)}
      />

      {/* Authentication Modal (for non-authenticated users only) */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action={authAction}
        requirePremium={false}
      />

      {/* Download Modal for Standard Premium Users */}
      {showDownloadModal && selectedEpisode && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-gray-900 p-8 rounded-xl border border-orange-400 shadow-xl max-w-sm w-full text-center">
            <h2 className="text-2xl font-bold mb-3 text-orange-400">Download Episode</h2>
            <p className="text-gray-300 mb-4">
              {selectedEpisode.title} - Episode {selectedEpisode.episode_number}
            </p>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 mb-3"
              onClick={async () => {
                const url = selectedEpisode.videolink_url || selectedEpisode.video_url;
                if (!url) return;
                let processedUrl = url;
                if (processedUrl.startsWith('encrypted://') || processedUrl.startsWith('auth://')) {
                  const urlPath = processedUrl.split('://')[1];
                  const username = process.env.NEXT_PUBLIC_CADDY_USERNAME || "mat";
                  const password = process.env.NEXT_PUBLIC_CADDY_PASSWORD || "MatTh3pAR";
                  processedUrl = `https://${username}:${password}@${urlPath}`;
                }
                if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
                  const cleanTitle = `${selectedEpisode.title} E${selectedEpisode.episode_number}`.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
                  const filename = `${cleanTitle}.mp4`;
                  processedUrl = `/api/stream?url=${encodeURIComponent(processedUrl)}&filename=${encodeURIComponent(filename)}`;
                }
                const a = document.createElement('a');
                a.href = processedUrl;
                a.download = `${selectedEpisode.title} E${selectedEpisode.episode_number}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setShowDownloadModal(false);
              }}
              disabled={!selectedEpisode.videolink_url && !selectedEpisode.video_url}
            >
              {selectedEpisode.videolink_url || selectedEpisode.video_url ? (
                <>Download Now</>
              ) : (
                <span className="text-gray-400">No download available.</span>
              )}
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setShowDownloadModal(false)}>Close</Button>
          </div>
        </div>
      )}

    </div>
  );
}