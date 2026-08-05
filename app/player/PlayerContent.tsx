"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import { ArrowLeft, AlertCircle, ChevronLeft, ChevronRight, Play, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import AuthRequiredModal, { useAuthCheck } from '@/components/AuthRequiredModal';
import { IOSDownloadModal } from '@/components/IOSDownloadModal';
import { getProfile, Profile } from '@/lib/profiles';
import { Episode, EpisodeWithSeason } from '@/lib/supabase';
import { normalizeVideoUrl } from '@/lib/utils';
import { getMovieById, getSeriesById, getEpisodes, getMovieStream, getEpisodeStream } from "@/lib/api";
import { isIOSDevice } from '@/lib/device-utils';

export default function PlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentData, setContentData] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<EpisodeWithSeason[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState<number>(-1);
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [switchingEpisode, setSwitchingEpisode] = useState(false);
  const [showIOSDownloadModal, setShowIOSDownloadModal] = useState(false);
  const [iosDownloadInfo, setIOSDownloadInfo] = useState<{ url: string; filename: string } | null>(null);
  // Tracks the content key for which we have already successfully fetched a stream URL,
  // preventing redundant re-fetches caused by multiple Supabase auth state events
  const streamFetchedRef = useRef<string | null>(null);

  const { user, loading: authLoading, isPremium } = useAuth();
  const { checkAuth } = useAuthCheck();

  const preloadNextEpisode = useCallback(() => {
    // No-op: video URLs are fetched dynamically
  }, [currentEpisodeIndex, allEpisodes]);

  useEffect(() => {
    if (!switchingEpisode && streamUrl) {
      const timer = setTimeout(preloadNextEpisode, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentEpisodeIndex, switchingEpisode, streamUrl, preloadNextEpisode]);

  useEffect(() => {
    if (user) {
      getProfile(user.id).then(setProfile);
    }
  }, [user, isPremium]);

  const contentId = searchParams.get('id');
  const contentType = searchParams.get('type');
  const episodeId = searchParams.get('episodeId');
  const seasonParam = searchParams.get('season');
  const episodeParam = searchParams.get('episode');

  useEffect(() => {
    const fetchStreamUrl = async () => {
      if (!contentId || !contentType) {
        setError('Missing content parameters');
        setLoading(false);
        return;
      }

      // Wait for auth to load
      if (authLoading) {
        return;
      }

      const fetchKey = `${contentId}-${contentType}-${episodeId ?? 'none'}-${seasonParam ?? ''}-${episodeParam ?? ''}`;
      if (streamFetchedRef.current === fetchKey) {
        return;
      }

      try {
        let contentTitle = '';
        let contentInfo: any = null;
        let actualSeriesId = contentId;
        let seasonNum = 1;
        let episodeNum = 1;

        if (contentType === 'movie') {
          // Fetch movie display data from ReelPlexi API
          const movie = await getMovieById(contentId);

          if (!movie) {
            throw new Error('Movie not found or not published');
          }

          contentInfo = movie;
          contentTitle = movie.title;

        } else if (contentType === 'series') {
          if (seasonParam && episodeParam) {
            seasonNum = parseInt(seasonParam, 10);
            episodeNum = parseInt(episodeParam, 10);
          } else if (episodeId && episodeId.includes(':season:')) {
            const parts = episodeId.split(':');
            actualSeriesId = parts[0];
            seasonNum = parseInt(parts[2], 10);
            episodeNum = parseInt(parts[4], 10);
          } else if (!episodeId) {
            throw new Error('Episode parameters required for series streaming');
          }

          const seriesData = await getSeriesById(actualSeriesId);
          if (!seriesData) {
            throw new Error('Series not found or not published');
          }

          const episodes = await getEpisodes(actualSeriesId, seasonNum);
          const episode = episodes.find((e: any) => e.episode_number === episodeNum) || episodes[0];

          if (!episode) {
            throw new Error('Episode not found or not published');
          }

          contentInfo = { ...episode, seasonOrder: seasonNum };
          contentTitle = `${seriesData.title || 'Series'} - Season ${seasonNum} - ${episode.title}`;

          // Store series ID for episode navigation
          setSeriesId(actualSeriesId);

          // Set all episodes for navigation
          const allEps = episodes.map((e: any) => ({
            ...e,
            seasonName: `Season ${seasonNum}`,
            seasonOrder: seasonNum,
            season_id: `${actualSeriesId}:season:${seasonNum}`
          })) as unknown as EpisodeWithSeason[];
          setAllEpisodes(allEps);
          const currentIndex = allEps.findIndex(e => e.id === episode.id || e.episode_number === episodeNum);
          setCurrentEpisodeIndex(currentIndex >= 0 ? currentIndex : 0);
        }

        setContentData(contentInfo);

        // Check authentication using unified system
        const authCheck = checkAuth(contentInfo?.premium);
        if (!authCheck.allowed) {
          setShowAuthModal(true);
          setLoading(false);
          return;
        }

        let finalStreamUrl = null;
        if (contentType === 'movie') {
          const streamData = await getMovieStream(contentId);
          finalStreamUrl = streamData?.video_url;
        } else {
          const streamData = await getEpisodeStream(seriesId || actualSeriesId, seasonNum, episodeNum);
          finalStreamUrl = streamData?.video_url;
        }

        if (!finalStreamUrl) {
          throw new Error('No video URL available');
        }

        streamFetchedRef.current = fetchKey;
        setStreamUrl(finalStreamUrl);
        setTitle(contentTitle);
        setLoading(false);

      } catch (err) {
        console.error('Error fetching stream URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to setup stream');
        setLoading(false);
      }
    };

    fetchStreamUrl();
  }, [contentId, contentType, episodeId, seasonParam, episodeParam, user?.id, authLoading]);

  // Switch to episode directly without page navigation
  const switchToEpisode = async (episode: EpisodeWithSeason) => {
    try {
      setSwitchingEpisode(true);
      setError(null);

      // Check authentication for episode
      const authCheck = checkAuth(episode.premium);
      if (!authCheck.allowed) {
        setShowAuthModal(true);
        setSwitchingEpisode(false);
        return;
      }

      // Update URL without full reload
      const newUrl = `/player?id=${seriesId || contentId}&type=series&season=${episode.seasonOrder || 1}&episode=${episode.episode_number}`;
      window.history.replaceState({}, '', newUrl);

      // Fetch video URL from ReelPlexi API
      const streamData = await getEpisodeStream(seriesId || contentId || '', episode.seasonOrder || 1, episode.episode_number);

      if (!streamData || !streamData.video_url) {
        setError('This episode is not available for watching');
        setSwitchingEpisode(false);
        return;
      }

      const videoUrl = streamData.video_url;

      // Update current episode index
      const newIndex = allEpisodes.findIndex(ep => ep.id === episode.id || ep.episode_number === episode.episode_number);
      setCurrentEpisodeIndex(newIndex >= 0 ? newIndex : 0);

      // Update stream URL and title
      setStreamUrl(videoUrl);
      setTitle(`${contentData?.title || 'Series'} - ${episode.seasonName} - ${episode.title}`);
      setSwitchingEpisode(false);

    } catch (err) {
      console.error('Error switching episode:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch episode');
      setSwitchingEpisode(false);
    }
  };

  const handleNextEpisode = () => {
    if (currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1) {
      const nextEpisode = allEpisodes[currentEpisodeIndex + 1];
      switchToEpisode(nextEpisode);
    }
  };

  const handlePreviousEpisode = () => {
    if (currentEpisodeIndex > 0) {
      const prevEpisode = allEpisodes[currentEpisodeIndex - 1];
      switchToEpisode(prevEpisode);
    }
  };

  const handleVideoEnd = useCallback(() => {
    if (contentType === 'series' && currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1) {
      setShowNextEpisodePrompt(true);
    }
  }, [contentType, currentEpisodeIndex, allEpisodes.length]);

  const handleAutoPlayNext = () => {
    setShowNextEpisodePrompt(false);
    handleNextEpisode();
  };

  const getCurrentEpisode = () => {
    return currentEpisodeIndex >= 0 ? allEpisodes[currentEpisodeIndex] : null;
  };

  const getNextEpisode = () => {
    return currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1
      ? allEpisodes[currentEpisodeIndex + 1]
      : null;
  };

  const handleEpisodeSelect = (episode: EpisodeWithSeason) => {
    switchToEpisode(episode);
  };

  const handleVideoError = (error: any) => {
    console.error('Video player error:', error?.message || 'Unknown');
    setError('Failed to play video. Check console for details.');
  };

  const handleVideoLoad = () => {
    console.log('Video loaded successfully');
    setError(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center px-4">
        <div className="text-center text-white max-w-sm w-full">
          <span className="inline-flex items-center justify-center font-bold tracking-widest text-2xl text-[#E50914]">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Loading Video...</h2>
          <p className="text-sm sm:text-base text-gray-400">Please wait while we prepare your stream</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
        <div className="max-w-sm sm:max-w-md w-full text-center text-white">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Stream Error</h2>
          <p className="text-sm sm:text-base text-gray-400 mb-6 leading-relaxed">{error}</p>
          <div className="space-y-3">
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-[#E50914] hover:bg-[#b80710] h-11 text-base font-medium"
            >
              Try Again
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 h-11 text-base font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentEpisode = getCurrentEpisode();
  const nextEpisode = getNextEpisode();
  const hasPrevious = currentEpisodeIndex > 0;
  const hasNext = currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1;

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top Navigation */}
      <div className="absolute top-2 left-2 z-50">
        <Button
          onClick={() => {
            if (contentType === 'series' && (seriesId || contentId)) {
              router.push(`/series/${seriesId || contentId}`);
            } else {
              router.back();
            }
          }}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 bg-black/60 backdrop-blur-sm h-8 px-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      </div>

      {/* Video Player Container */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        {switchingEpisode && (
          <div className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center">
            <div className="text-center text-white">
              <span className="inline-flex items-center justify-center font-bold tracking-widest text-2xl text-[#E50914]">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
              <p className="text-lg font-semibold">Switching Episode...</p>
            </div>
          </div>
        )}
        <VideoPlayer
          key={`player-${streamUrl}`}
          src={streamUrl}
          title={title}
          onError={handleVideoError}
          onLoad={handleVideoLoad}
          onEnded={handleVideoEnd}
          subscriptionPlan={profile?.subscription || null}
          isPremiumContent={contentData?.premium || false}
          episodes={allEpisodes}
          currentEpisodeIndex={currentEpisodeIndex}
          onEpisodeSelect={handleEpisodeSelect}
          contentType={contentType || undefined}
        />
      </div>

      {/* Bottom Section - Episode Info and List */}
      {contentType === 'series' && (
        <div className="bg-black flex-1 flex flex-col overflow-hidden">
          {/* Current Episode Title */}
          {currentEpisode && (
            <div className="p-3 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold text-lg truncate">
                    {currentEpisode.title}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {currentEpisode.seasonName} • Episode {currentEpisode.episode_number}
                  </p>
                </div>

                {/* Navigation Controls */}
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={handlePreviousEpisode}
                    disabled={!hasPrevious}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-gray-800 h-8 w-8 p-0 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleNextEpisode}
                    disabled={!hasNext}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-gray-800 h-8 w-8 p-0 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Episode List */}
          {allEpisodes.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-2">
                <div className="grid grid-cols-1 gap-1">
                  {allEpisodes.map((episode, index) => {
                    const isCurrentEpisode = index === currentEpisodeIndex;
                    const isPremiumEpisode = episode.premium;
                    const canAccess = checkAuth(isPremiumEpisode).allowed;

                    return (
                      <div
                        key={episode.id || index}
                        className={`group p-2 rounded cursor-pointer transition-colors ${isCurrentEpisode
                          ? 'bg-[#E50914]/20 border border-[#E50914]/30'
                          : canAccess
                            ? 'hover:bg-gray-800'
                            : 'opacity-60'
                          }`}
                        onClick={() => canAccess && handleEpisodeSelect(episode)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Episode Thumbnail */}
                          <div className="relative w-12 h-8 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                            {episode.thumbnail_url ? (
                              <img
                                src={episode.thumbnail_url}
                                alt={episode.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`${episode.thumbnail_url ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                              <div className={`w-6 h-4 rounded flex items-center justify-center text-xs font-bold ${isCurrentEpisode
                                ? 'bg-[#E50914] text-white'
                                : 'bg-gray-600 text-gray-300'
                                }`}>
                                {episode.episode_number}
                              </div>
                            </div>
                            {isCurrentEpisode && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Play className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm font-medium truncate">
                                  {episode.title}
                                </span>
                                {isPremiumEpisode && (
                                  <span className="text-xs bg-[#E50914] text-white px-1 py-0.5 rounded flex-shrink-0">
                                    Premium
                                  </span>
                                )}
                                {isCurrentEpisode && (
                                  <Play className="w-3 h-3 text-[#E50914] flex-shrink-0" />
                                )}
                              </div>
                              <div className="text-xs text-gray-400">
                                {episode.seasonName}
                              </div>
                              {!canAccess && (
                                <div className="text-xs text-red-400">
                                  {isPremiumEpisode ? 'Premium Required' : 'Login Required'}
                                </div>
                              )}
                            </div>

                            {/* Download Button */}
                            {canAccess && (
                              <button
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-white transition-opacity shrink-0"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const cleanTitle = episode.title ? episode.title.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim() : 'episode';
                                  const filename = `${cleanTitle}.mp4`;

                                  const isIOS = isIOSDevice();

                                  if (isIOS) {
                                    try {
                                      const response = await fetch(`/api/download?id=${seriesId || contentId}&type=episode&season=${episode.seasonOrder || 1}&episode=${episode.episode_number}&filename=${encodeURIComponent(filename)}`);
                                      const data = await response.json();

                                      if (data.downloadUrl) {
                                        setIOSDownloadInfo({
                                          url: data.downloadUrl,
                                          filename: filename
                                        });
                                        setShowIOSDownloadModal(true);
                                      }
                                    } catch (error) {
                                      alert('Failed to get download link. Please try again.');
                                    }
                                  } else {
                                    const proxyUrl = `/api/download?id=${seriesId || contentId}&type=episode&season=${episode.seasonOrder || 1}&episode=${episode.episode_number}&filename=${encodeURIComponent(filename)}`;
                                    window.open(proxyUrl, '_blank');
                                  }
                                }}
                                title="Download"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Next Episode Prompt Modal */}
      {showNextEpisodePrompt && nextEpisode && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-[#E50914] shadow-xl max-w-md w-full text-center p-6">
            <h2 className="text-2xl font-bold mb-3 text-[#E50914]">Episode Ended</h2>
            <p className="mb-4 text-gray-200">
              Up next: <span className="font-semibold">{nextEpisode.seasonName} - Episode {nextEpisode.episode_number}</span>
            </p>
            <p className="mb-6 text-gray-300 font-medium">{nextEpisode.title}</p>

            <div className="flex gap-3">
              <Button
                onClick={handleAutoPlayNext}
                className="flex-1 bg-[#E50914] hover:bg-[#b80710] h-12 text-base font-medium"
              >
                <Play className="w-5 h-5 mr-2" />
                Play Next Episode
              </Button>
              <Button
                onClick={() => setShowNextEpisodePrompt(false)}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 h-12 text-base font-medium"
              >
                Stay Here
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="play"
        requirePremium={Boolean(contentData?.premium)}
      />

      {/* iOS Download Modal */}
      {iosDownloadInfo && (
        <IOSDownloadModal
          isOpen={showIOSDownloadModal}
          onClose={() => {
            setShowIOSDownloadModal(false);
            setIOSDownloadInfo(null);
          }}
          downloadUrl={iosDownloadInfo.url}
          filename={iosDownloadInfo.filename}
        />
      )}
    </div>
  );
}