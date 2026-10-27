import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Camera,
  Shirt,
  Users,
  Compass,
  ArrowRight,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { DailyFitWidget } from '../components/feed/DailyFitWidget';
import { PostCard } from '../components/feed/PostCard';
import { DiscoveryDeck } from '../components/feed/DiscoveryDeck';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Post, OutfitMoment } from '../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const { followingIds, isFollowingUser } = useApp();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'for_you' | 'following'>(
    tabParam === 'following' ? 'following' : 'for_you'
  );

  // Sync tab with URL search parameter if present
  useEffect(() => {
    if (tabParam === 'following' || tabParam === 'for-you') {
      setActiveTab(tabParam === 'following' ? 'following' : 'for_you');
    }
  }, [tabParam]);

  // For You discovery moments (unexpired 24-hour outfit moments)
  const [forYouMoments, setForYouMoments] = useState<OutfitMoment[]>([]);
  const [isLoadingForYou, setIsLoadingForYou] = useState(true);
  const [forYouError, setForYouError] = useState<string | null>(null);

  // Following feed (permanent posts from creators the user follows)
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Load For You discovery moments (unexpired, excludes seen/swiped)
  const loadForYouMoments = useCallback(async () => {
    setIsLoadingForYou(true);
    setForYouError(null);
    try {
      const data = await api.moments.listFeed();
      setForYouMoments(data);
    } catch (err: any) {
      setForYouError(err?.message || 'Failed to load discovery moments.');
    } finally {
      setIsLoadingForYou(false);
    }
  }, []);

  // Load Following feed permanent posts
  const loadFollowingPosts = useCallback(async () => {
    setIsLoadingFollowing(true);
    setFollowingError(null);
    try {
      const data = await api.posts.listFeed('following');
      setFollowingPosts(data);
    } catch (err: any) {
      setFollowingError(err?.message || 'Failed to load following feed.');
    } finally {
      setIsLoadingFollowing(false);
    }
  }, []);

  // Reload moments and following feed whenever follow relationships change
  useEffect(() => {
    loadForYouMoments();
    if (activeTab === 'following') {
      loadFollowingPosts();
    }
  }, [loadForYouMoments, loadFollowingPosts, followingIds, activeTab]);

  // Ensure only moments from followed accounts are displayed
  const visibleMoments = forYouMoments.filter(
    (m) => m.user && isFollowingUser(m.user.id)
  );

  // Discovery Like Handler (Persists like and sends notification via backend)
  const handleDiscoveryLike = async (moment: OutfitMoment) => {
    await api.moments.like(moment.id);
  };

  // Discovery Skip Handler (Marks moment as seen without notifying)
  const handleDiscoverySkip = async (moment: OutfitMoment) => {
    await api.moments.skip(moment.id);
  };

  return (
    <AppShell showRightSidebar={true}>
      {/* Top Editorial Greeting */}
      <div className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-charcoal-950 tracking-tight">
          {getGreeting()}, {currentUser.name.split(' ')[0]} 👋
        </h1>
        <p className="text-xs sm:text-sm text-charcoal-500 mt-1 font-sans">
          {activeTab === 'for_you'
            ? "Swipe through today's 24-hour moments from creators you follow. Right to like, left to pass."
            : 'Recent outfits and community looks from curators you follow.'}
        </p>
      </div>

      {/* Two Compact Quick-Action Cards: Share Daily Outfit & My Library */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
        {/* Share Daily Outfit Card */}
        <div
          onClick={() => navigate('/create?type=moment')}
          className="group cursor-pointer p-4 sm:p-5 rounded-3xl bg-cream-50 hover:bg-sand-100/80 border border-sand-200/90 shadow-soft transition-all duration-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cognac-100 text-cognac-800 flex items-center justify-center group-hover:scale-105 transition-transform shadow-soft-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-sm text-charcoal-900 group-hover:text-cognac-800 transition-colors">
                Share Daily Outfit
              </h2>
              <p className="text-[11px] text-charcoal-400">
                Share a 24h outfit moment with your followers
              </p>
            </div>
          </div>
          <span className="p-2 rounded-full bg-sand-200/60 group-hover:bg-cognac-700 group-hover:text-white transition-colors text-charcoal-600">
            <PlusCircle className="w-4 h-4" />
          </span>
        </div>

        {/* My Library Card */}
        <div
          onClick={() => navigate('/profile')}
          className="group cursor-pointer p-4 sm:p-5 rounded-3xl bg-cream-50 hover:bg-sand-100/80 border border-sand-200/90 shadow-soft transition-all duration-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sand-200/80 text-charcoal-800 flex items-center justify-center group-hover:scale-105 transition-transform shadow-soft-sm">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-sm text-charcoal-900 group-hover:text-cognac-800 transition-colors">
                My Library
              </h2>
              <p className="text-[11px] text-charcoal-400">
                Browse your published archive & wardrobe
              </p>
            </div>
          </div>
          <span className="p-2 rounded-full bg-sand-200/60 group-hover:bg-charcoal-900 group-hover:text-white transition-colors text-charcoal-600">
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Daily Fit Highlight Teaser */}
      <div className="mb-7">
        <DailyFitWidget />
      </div>

      {/* Feed Tabs: Only "For You" and "Following" (Stories and Trending removed) */}
      <div className="flex items-center justify-between border-b border-sand-200/90 mb-6">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setActiveTab('for_you')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === 'for_you'
                ? 'text-charcoal-950 font-bold'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            For You
            {activeTab === 'for_you' && (
              <motion.div
                layoutId="homeFeedTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-charcoal-900"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('following')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === 'following'
                ? 'text-charcoal-950 font-bold'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            Following
            {activeTab === 'following' && (
              <motion.div
                layoutId="homeFeedTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-charcoal-900"
              />
            )}
          </button>
        </div>

        {activeTab === 'following' && (
          <button
            onClick={loadFollowingPosts}
            disabled={isLoadingFollowing}
            className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-800 pb-3 font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFollowing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Feed</span>
          </button>
        )}
      </div>

      {/* TAB 1: FOR YOU (Tinder-Style Discovery Deck) */}
      {activeTab === 'for_you' && (
        <div className="w-full">
          {forYouError ? (
            <div className="text-center py-16 px-4 bg-cream-50 rounded-3xl border border-sand-200 shadow-soft max-w-md mx-auto">
              <p className="text-xs font-semibold text-rose-600 mb-2">Discovery Deck Unavailable</p>
              <p className="text-xs text-charcoal-500 mb-4">{forYouError}</p>
              <Button
                variant="primary"
                size="sm"
                onClick={loadForYouMoments}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
            </div>
          ) : (
            <DiscoveryDeck
              moments={visibleMoments}
              onLike={handleDiscoveryLike}
              onSkip={handleDiscoverySkip}
              onRefresh={loadForYouMoments}
              isLoading={isLoadingForYou}
            />
          )}
        </div>
      )}

      {/* TAB 2: FOLLOWING (Conventional Instagram-Style Feed) */}
      {activeTab === 'following' && (
        <div className="space-y-6">
          {isLoadingFollowing ? (
            <div className="text-center py-16 bg-cream-50 rounded-3xl border border-sand-200 shadow-soft">
              <Sparkles className="w-6 h-6 text-cognac-600 animate-spin mx-auto mb-2.5" />
              <p className="text-xs font-medium text-charcoal-500">
                Fetching latest looks from curators you follow...
              </p>
            </div>
          ) : followingError ? (
            <div className="text-center py-16 px-4 bg-cream-50 rounded-3xl border border-sand-200 shadow-soft max-w-md mx-auto">
              <p className="text-xs font-semibold text-rose-600 mb-2">Unable to load feed</p>
              <p className="text-xs text-charcoal-500 mb-4">{followingError}</p>
              <Button
                variant="primary"
                size="sm"
                onClick={loadFollowingPosts}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry Feed
              </Button>
            </div>
          ) : followingPosts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-cream-50 rounded-3xl border border-sand-200 shadow-soft max-w-md mx-auto space-y-3.5">
              <div className="w-14 h-14 rounded-full bg-sand-100 text-cognac-700 flex items-center justify-center mx-auto shadow-soft-sm">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="font-serif font-bold text-charcoal-900 text-lg">
                Your Following Feed is Quiet
              </h2>
              <p className="text-xs text-charcoal-500 leading-relaxed max-w-sm mx-auto">
                You haven't followed any style creators yet, or curators you follow haven't shared a recent look.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/explore')}
                  icon={<Compass className="w-3.5 h-3.5" />}
                  className="mx-auto"
                >
                  Explore Style Curators
                </Button>
              </div>
            </div>
          ) : (
            followingPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      )}
    </AppShell>
  );
};

