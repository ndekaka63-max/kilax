"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import HeroDetail from "@/components/HeroDetail";
import { useAuth } from "@/components/AuthProvider";
import { supabase, Movie, MovieWithVJ, SeriesWithVJ } from "@/lib/supabase";
import AuthRequiredModal, { useAuthCheck } from '@/components/AuthRequiredModal';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import { FullPageSpinner, InlineSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { NetflixCard } from "@/components/NetflixCard";
import { isStandardPremium } from "@/lib/isStandardPremium";

export default function MovieDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, isPremium } = useAuth();
  const { checkAuth } = useAuthCheck();

  const [movie, setMovie] = useState<MovieWithVJ | null>(null);
  const [isStandardPremiumUser, setIsStandardPremiumUser] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      if (!user) { setIsStandardPremiumUser(false); return; }
      const subscription = await (await import("@/lib/subscriptions")).getUserSubscription(user.id);
      const { isStandardPremium: checkStandard } = await import("@/lib/isStandardPremium");
      setIsStandardPremiumUser(checkStandard(subscription));
    })();
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPremiumUpgradeModal, setShowPremiumUpgradeModal] = useState(false);

  // Unified auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<'play' | 'download'>('play');
  const [related, setRelated] = useState<MovieWithVJ[]>([]);
  const [relatedSeries, setRelatedSeries] = useState<SeriesWithVJ[]>([]);
  const [genres, setGenres] = useState<{ id: string; name: string }[]>([]);
  const [vj, setVj] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    async function fetchCriticalData() {
      setLoading(true);
      setError(null);
      if (!params?.id) {
        setError("No movie ID provided");
        setLoading(false);
        return;
      }

      // First, fetch only the essential movie data
      const { data, error } = await supabase
        .from("movies")
        .select("*, vjs(name)")
        .eq("id", params.id)
        .single();

      if (error || !data) {
        setError("Movie not found");
        setLoading(false);
        return;
      }

      setMovie(data);
      setLoading(false); // Hide skeleton as soon as main content is ready

      // Then fetch additional data progressively
      const promises = [];

      // Fetch genres
      if (data.genre_ids && data.genre_ids.length > 0) {
        promises.push(
          supabase
            .from('genres')
            .select('*')
            .in('id', data.genre_ids)
            .then(({ data: genreData }) => setGenres(genreData || []))
        );
      }

      // Fetch VJ
      if (data.vj_id) {
        promises.push(
          supabase
            .from('vjs')
            .select('*')
            .eq('id', data.vj_id)
            .single()
            .then(({ data: vjData }) => setVj(vjData))
        );
      }

      // Fetch related content
      if (data.genre_ids && data.genre_ids.length > 0) {
        promises.push(
          supabase
            .from("movies")
            .select("*, vjs(name)")
            .neq("id", params.id)
            .overlaps("genre_ids", data.genre_ids)
            .order("created_at", { ascending: false })
            .limit(6)
            .then(({ data: relatedMovies }) => setRelated(relatedMovies || []))
        );

        promises.push(
          supabase
            .from("series")
            .select("*, vjs(name)")
            .overlaps("genre_ids", data.genre_ids)
            .order("created_at", { ascending: false })
            .limit(6)
            .then(({ data: relatedSeriesData }) => setRelatedSeries(relatedSeriesData || []))
        );
      }

      // Execute all additional fetches in parallel
      await Promise.all(promises);
    }
    fetchCriticalData();
  }, [params.id]);

  if (loading || authLoading) {
    return <FullPageSpinner text="Loading movie details..." />;
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{error || "Movie Not Found"}</h1>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => router.push("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  // Restriction logic
  const handleWatch = () => {
    // Check authentication first
    if (!user?.id) {
      setAuthAction('play');
      setShowAuthModal(true);
      return;
    }

    // Check if movie requires premium and user doesn't have it
    if (movie.premium && !isPremium) {
      // Show premium upgrade modal instead of auth modal
      setShowPremiumUpgradeModal(true);
      return;
    }

    // Go to player page
    router.push(`/player?id=${movie.id}&type=movie`);
  };

  const handleDownload = async () => {
    // Check authentication first
    if (!user?.id) {
      setAuthAction('download');
      setShowAuthModal(true);
      return;
    }

    // Check if movie requires premium and user doesn't have it
    if (movie.premium && !isPremium) {
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

    setShowDownloadModal(true);
  };



  return (
    <div className="min-h-screen bg-black text-white">
      <HeroDetail
        title={movie.title}
        subtitle={undefined}
        description={movie.description || "No description."}
        year={movie.release_date ? new Date(movie.release_date).getFullYear().toString() : ""}
        vj={vj?.name || ""}
        genres={genres.length > 0 ? genres.map(g => g.name) : ["Drama"]}
        coverImage={movie.cover_image_url || "https://via.placeholder.com/250x375/1f2937/f97316?text=" + encodeURIComponent(movie.title)}
        onWatch={handleWatch}

        onDownload={handleDownload}
        primaryColor="#f97316"
      />
      {/* Related Movies */}
      <div className="container mx-auto px-6 mt-12">
        <h2 className="text-2xl font-bold mb-6">Related Movies</h2>
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
          {related.length > 0 ? (
            related.map((r) => (
              <div key={r.id} className="flex-shrink-0 w-[120px] md:w-[150px] lg:w-[160px]">
                <NetflixCard content={r} type="movie" />
              </div>
            ))
          ) : (
            // Progressive loading skeleton
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[120px] md:w-[150px]">
                <div className="aspect-[2/3] rounded-lg bg-gray-800/30 animate-pulse"></div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Related Series */}
      <div className="container mx-auto px-6 mt-12">
        <h2 className="text-2xl font-bold mb-6">Related Series</h2>
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
          {relatedSeries.length > 0 ? (
            relatedSeries.map((s) => (
              <div key={s.id} className="flex-shrink-0 w-[120px] md:w-[150px] lg:w-[160px]">
                <NetflixCard content={s} type="series" />
              </div>
            ))
          ) : (
            // Progressive loading skeleton
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[120px] md:w-[150px]">
                <div className="aspect-[2/3] rounded-lg bg-gray-800/30 animate-pulse"></div>
              </div>
            ))
          )}
        </div>
      </div>


      {/* Download Modal for Standard Premium Users */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-gray-900 p-8 rounded-xl border border-orange-400 shadow-xl max-w-sm w-full text-center">
            <h2 className="text-2xl font-bold mb-3 text-orange-400">Download Movie</h2>
            {/* No extra statement here */}
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 mb-3"
              onClick={async () => {
                const url = movie.video_url || movie.videolink_url;
                if (!url) return;
                let processedUrl = url;
                // Handle encrypted/auth URLs (reuse logic from handleDownload)
                if (processedUrl.startsWith('encrypted://') || processedUrl.startsWith('auth://')) {
                  const urlPath = processedUrl.split('://')[1];
                  const username = process.env.NEXT_PUBLIC_CADDY_USERNAME || "mat";
                  const password = process.env.NEXT_PUBLIC_CADDY_PASSWORD || "MatTh3pAR";
                  processedUrl = `https://${username}:${password}@${urlPath}`;
                }
                if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
                  const cleanTitle = movie.title.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
                  const filename = `${cleanTitle}.mp4`;
                  processedUrl = `/api/stream?url=${encodeURIComponent(processedUrl)}&filename=${encodeURIComponent(filename)}`;
                }
                // Create a hidden anchor and click it for direct download
                const a = document.createElement('a');
                a.href = processedUrl;
                a.download = movie.title + '.mp4';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setShowDownloadModal(false);
              }}
              disabled={!movie.video_url && !movie.videolink_url}
            >
              {movie.video_url || movie.videolink_url ? (
                <>Download Now</>
              ) : (
                <span className="text-gray-400">No download available.</span>
              )}
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setShowDownloadModal(false)}>Close</Button>
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
    </div>
  );
}