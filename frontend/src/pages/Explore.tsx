import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Users,
  Compass,
  X,
  Sparkles,
  RefreshCw,
  Flame,
  Globe,
  Lock,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { EditorialMosaic } from '../components/explore/EditorialMosaic';
import { CreateCommunityModal } from '../components/community/CreateCommunityModal';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import {
  ExplorePostItem,
  TrendingPostItem,
  RecommendedPerson,
  Community,
  UserSearchResult,
  Post,
} from '../types';

const COMMUNITY_CATEGORIES = [
  'All',
  'Minimalist',
  'Streetwear',
  'Indian Ethnic',
  'Quiet Luxury',
  'Vintage & Thrift',
  'Casual Daily',
  'Smart Casual',
  'Sustainable',
  'Athleisure',
];

const COLORS = ['All Colors', 'White', 'Black', 'Beige', 'Cognac', 'Brown', 'Navy', 'Denim Blue'];
const SEASONS = ['All Seasons', 'Summer', 'Autumn', 'Winter', 'Spring'];

export const Explore: React.FC = () => {
  const { posts, isFollowingUser, toggleFollowUser, refreshData, showToast } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  // 4 Primary Navigation Tabs: For You | Communities | Trending | People
  const [activeTab, setActiveTab] = useState<'for_you' | 'communities' | 'trending' | 'people'>('for_you');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('All Colors');
  const [selectedSeason, setSelectedSeason] = useState('All Seasons');
  const [showFilters, setShowFilters] = useState(false);

  // Tab Data States
  const [forYouItems, setForYouItems] = useState<ExplorePostItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<TrendingPostItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommCategory, setActiveCommCategory] = useState('All');
  const [recommendedPeople, setRecommendedPeople] = useState<RecommendedPerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Community modal state
  const [isCreateCommModalOpen, setIsCreateCommModalOpen] = useState(false);

  // Load active tab data
  const loadTabData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'for_you') {
        const res = await api.explore.getFeed(40);
        setForYouItems(res.items);
      } else if (activeTab === 'trending') {
        const res = await api.explore.getTrending(40);
        setTrendingItems(res.items);
      } else if (activeTab === 'communities') {
        const cat = activeCommCategory === 'All' ? undefined : activeCommCategory;
        const res = await api.explore.getCommunities({ category: cat, query: searchQuery.trim() || undefined });
        setCommunities(res);
      } else if (activeTab === 'people') {
        const res = await api.explore.getPeople(30);
        setRecommendedPeople(res.people);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load explore content', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab, activeCommCategory]);

  const handleRefresh = async () => {
    await Promise.all([refreshData(), loadTabData()]);
  };

  // Convert forYouItems or fallback posts for EditorialMosaic
  const displayPosts: Post[] = useMemo(() => {
    if (forYouItems.length > 0) {
      const extracted: Post[] = [];
      for (const item of forYouItems) {
        if (item.post) extracted.push(item.post);
      }
      if (extracted.length > 0) return extracted;
    }
    return posts;
  }, [forYouItems, posts]);

  const handleJoinCommunity = async (comm: Community, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.communities.join(comm.id);
      if (res.status === 'requested') {
        showToast('Request submitted for approval', 'success');
      } else {
        showToast(`Joined ${comm.name}!`, 'success');
      }
      loadTabData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to join community', 'error');
    }
  };

  return (
    <AppShell showRightSidebar={true}>
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Header and Search */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                Fashion Discovery
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Explore The Circle
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'communities' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsCreateCommModalOpen(true)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Community
                </Button>
              )}
              <button
                onClick={handleRefresh}
                aria-label="Refresh discovery feed"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* 4 PRIMARY NAVIGATION TABS */}
          <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800">
            {(
              [
                { id: 'for_you', label: 'For You', icon: Compass },
                { id: 'communities', label: 'Communities', icon: Users },
                { id: 'trending', label: 'Trending', icon: Flame },
                { id: 'people', label: 'People', icon: Sparkles },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`pb-2.5 min-h-[44px] text-xs sm:text-sm font-medium tracking-wide transition-all relative flex items-center gap-1.5 ${
                    isActive
                      ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {isActive && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900 dark:bg-zinc-100" />
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: FOR YOU SEARCH & FILTERS */}
          {activeTab === 'for_you' && (
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search outfits, garments, fabrics, aesthetics..."
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md pl-10 pr-10 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3.5 text-zinc-400 hover:text-zinc-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-md border text-xs font-semibold transition-colors ${
                  showFilters
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          )}

          {/* Filter Drawer for For You */}
          {showFilters && activeTab === 'for_you' && (
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 block mb-2">
                  Palette
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`text-xs px-3 py-1.5 rounded-md border ${
                        selectedColor === c
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMUNITIES CATEGORY PILLS */}
          {activeTab === 'communities' && (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fashion circles and aesthetics..."
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md pl-10 pr-10 py-2.5 min-h-[44px] text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {COMMUNITY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCommCategory(cat)}
                    className={`text-xs px-3.5 py-2 min-h-[38px] rounded-md border whitespace-nowrap transition-all font-medium ${
                      activeCommCategory === cat
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="text-center py-20">
            <Sparkles className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-500">Curating fashion discovery...</p>
          </div>
        )}

        {/* TAB 1 CONTENT: FOR YOU */}
        {!isLoading && activeTab === 'for_you' && (
          <div className="space-y-6">
            <EditorialMosaic posts={displayPosts} />
          </div>
        )}

        {/* TAB 2 CONTENT: COMMUNITIES */}
        {!isLoading && activeTab === 'communities' && (
          <div>
            {communities.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Users className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-zinc-900 dark:text-zinc-100">No fashion communities found</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                  Be the first to create a community for this aesthetic!
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsCreateCommModalOpen(true)}
                  className="mt-4"
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Community
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {communities.map((comm) => (
                  <div
                    key={comm.id}
                    onClick={() => navigate(`/communities/${comm.slug}`)}
                    className="group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer flex flex-col"
                  >
                    <div className="h-28 bg-gradient-to-r from-zinc-800 to-zinc-950 relative overflow-hidden">
                      {comm.cover_image_url && (
                        <img
                          src={comm.cover_image_url}
                          alt={comm.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-60"
                        />
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center gap-1">
                          {comm.visibility === 'public' ? (
                            <>
                              <Globe className="w-2.5 h-2.5 text-emerald-400" /> Public
                            </>
                          ) : (
                            <>
                              <Lock className="w-2.5 h-2.5 text-amber-400" /> Private
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                          {comm.category}
                        </span>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                          {comm.name}
                        </h3>
                        {comm.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">
                            {comm.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {comm.members_count} members
                        </span>

                        <Button
                          size="sm"
                          variant={comm.is_member ? 'outline' : 'primary'}
                          onClick={(e) => handleJoinCommunity(comm, e)}
                          className="text-xs px-2.5 py-1 min-h-[32px]"
                        >
                          {comm.is_member ? 'Joined' : '+ Join'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3 CONTENT: TRENDING WITH TIME-DECAYED SCORES */}
        {!isLoading && activeTab === 'trending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Top Trending Looks
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Ranked by real engagement, saves, community votes and time recency.
                </p>
              </div>
            </div>

            {trendingItems.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Flame className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-70" />
                <p className="font-bold text-zinc-900 dark:text-zinc-100">No trending fits yet</p>
                <p className="text-xs text-zinc-500 mt-1">Post a new outfit to spark the leaderboard!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {trendingItems.map((item) => {
                  const rankBadgeClass =
                    item.rank === 1
                      ? 'bg-amber-400 text-black font-extrabold shadow-sm'
                      : item.rank === 2
                      ? 'bg-zinc-300 text-zinc-900 font-bold'
                      : item.rank === 3
                      ? 'bg-amber-700 text-white font-bold'
                      : 'bg-black/60 text-white font-semibold backdrop-blur-md';

                  return (
                    <div
                      key={item.post.id}
                      onClick={() => navigate(`/home?post=${item.post.id}`)}
                      className="group rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer flex flex-col"
                    >
                      <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <img
                          src={item.post.image_url || (item.post as any).image}
                          alt={item.post.caption}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${rankBadgeClass}`}
                          >
                            #{item.rank}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                            {item.post.caption || 'Style Fit'}
                          </p>
                          <p className="text-[11px] text-zinc-500">@{item.post.user?.username}</p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                          <span>{item.post.likes_count || 0} Likes</span>
                          <span className="font-mono text-zinc-500">Score {item.score}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4 CONTENT: PEOPLE & TASTEMAKERS */}
        {!isLoading && activeTab === 'people' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Taste-Matched Creators
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Curators recommended based on shared aesthetic vibes and style categories.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {recommendedPeople.map((person) => {
                const following = isFollowingUser(person.user.id);
                const isMe = currentUser && person.user.id === currentUser.id;

                return (
                  <div
                    key={person.user.id}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                  >
                    <div
                      onClick={() => navigate(`/profile/${person.user.username}`)}
                      className="flex items-start gap-3.5 cursor-pointer min-w-0 flex-1"
                    >
                      <Avatar
                        src={person.user.avatar}
                        alt={person.user.name}
                        size="md"
                        isVerified={person.user.is_verified}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {person.user.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">@{person.user.username}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-1">
                          {person.match_reason}
                        </p>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {person.common_styles.map((style) => (
                            <span
                              key={style}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            >
                              {style}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {!isMe && (
                      <Button
                        size="sm"
                        variant={following ? 'outline' : 'primary'}
                        onClick={() => toggleFollowUser(person.user.id)}
                        className="text-xs px-3 py-1 flex-shrink-0 min-h-[36px]"
                      >
                        {following ? 'Following' : '+ Follow'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CREATE COMMUNITY MODAL */}
        <CreateCommunityModal
          isOpen={isCreateCommModalOpen}
          onClose={() => setIsCreateCommModalOpen(false)}
          onSuccess={(newComm) => {
            setCommunities((prev) => [newComm, ...prev]);
            navigate(`/communities/${newComm.slug}`);
          }}
        />
      </PullToRefresh>
    </AppShell>
  );
};
