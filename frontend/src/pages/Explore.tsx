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
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { EditorialMosaic } from '../components/explore/EditorialMosaic';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { UserSearchResult } from '../types';

const CATEGORIES = [
  'All',
  'Trending',
  'Casual',
  'Streetwear',
  'Work',
  'Party',
  'Travel',
  'Date Night',
  'Minimal',
  'Vintage',
  'Summer',
];

const COLORS = ['All Colors', 'White', 'Black', 'Beige', 'Cognac', 'Brown', 'Navy', 'Denim Blue'];
const SEASONS = ['All Seasons', 'Summer', 'Autumn', 'Winter', 'Spring'];

export const Explore: React.FC = () => {
  const { posts, isFollowingUser, toggleFollowUser, refreshData } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [activeSubTab, setActiveSubTab] = useState<'outfits' | 'creators'>('outfits');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedColor, setSelectedColor] = useState('All Colors');
  const [selectedSeason, setSelectedSeason] = useState('All Seasons');
  const [showFilters, setShowFilters] = useState(false);

  // Server-side user search state
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);

  // Debounced server-side user search
  useEffect(() => {
    if (activeSubTab !== 'creators') return;

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      setUserSearchError(null);
      try {
        const results = await api.users.search(searchQuery.trim());
        setSearchResults(results);
      } catch (err: any) {
        setUserSearchError(err?.message || 'Failed to search tastemakers.');
      } finally {
        setIsSearchingUsers(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, activeSubTab]);

  // Derive real style curators from existing posts in Neon database
  const styleCurators = useMemo(() => {
    const map = new Map<string, (typeof posts)[0]['user']>();
    for (const p of posts) {
      if (p.user && p.user.id && !map.has(p.user.id)) {
        map.set(p.user.id, p.user);
      }
    }
    return Array.from(map.values());
  }, [posts]);

  // Search and filter outfits
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        post.caption.toLowerCase().includes(q) ||
        post.user.name.toLowerCase().includes(q) ||
        post.user.username.toLowerCase().includes(q) ||
        (post.location && post.location.toLowerCase().includes(q)) ||
        (post.tags && post.tags.some((t) => t.toLowerCase().includes(q))) ||
        (post.taggedItems &&
          post.taggedItems.some(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              i.category.toLowerCase().includes(q) ||
              (i.color && i.color.toLowerCase().includes(q)) ||
              (i.brand && i.brand.toLowerCase().includes(q))
          ));

      const matchesCategory =
        activeCategory === 'All' ||
        activeCategory === 'Trending' ||
        (post.tags && post.tags.some((t) => t.toLowerCase().includes(activeCategory.toLowerCase()))) ||
        (post.taggedItems &&
          post.taggedItems.some((i) => i.category.toLowerCase().includes(activeCategory.toLowerCase())));

      const matchesColor =
        selectedColor === 'All Colors' ||
        (post.taggedItems &&
          post.taggedItems.some((i) => i.color && i.color.toLowerCase() === selectedColor.toLowerCase()));

      const matchesSeason =
        selectedSeason === 'All Seasons' ||
        (post.taggedItems &&
          post.taggedItems.some((i) => i.season && i.season.toLowerCase() === selectedSeason.toLowerCase()));

      return matchesSearch && matchesCategory && matchesColor && matchesSeason;
    });
  }, [posts, searchQuery, activeCategory, selectedColor, selectedSeason]);

  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <AppShell showRightSidebar={true}>
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Header and Search */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                Curated Discovery
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Explore The Collection
              </h1>
            </div>

            <button
              onClick={handleRefresh}
              aria-label="Refresh discovery feed"
              title="Refresh discovery"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Sub-Tabs: Outfits Mosaic vs Curators Search */}
          <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveSubTab('outfits')}
              className={`pb-2.5 min-h-[44px] text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeSubTab === 'outfits'
                  ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Looks & Trends
              {activeSubTab === 'outfits' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900 dark:bg-zinc-100" />
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('creators')}
              className={`pb-2.5 min-h-[44px] text-xs sm:text-sm font-medium tracking-wide transition-all relative ${
                activeSubTab === 'creators'
                  ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Style Curators
              {activeSubTab === 'creators' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900 dark:bg-zinc-100" />
              )}
            </button>
          </div>

          {/* Search bar & Filter Trigger */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeSubTab === 'creators'
                    ? 'Search tastemakers by username or name...'
                    : 'Search outfits, garments, fabrics, aesthetics...'
                }
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md pl-10 pr-10 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-colors"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-3.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {activeSubTab === 'outfits' && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Toggle filters"
                className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-md border text-xs font-semibold transition-colors ${
                  showFilters || selectedColor !== 'All Colors' || selectedSeason !== 'All Seasons'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            )}
          </div>

          {/* Expandable Filter drawer */}
          {showFilters && activeSubTab === 'outfits' && (
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400 block mb-2">
                  Filter by Palette
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`text-xs px-3 py-1.5 min-h-[36px] rounded-md border transition-all ${
                        selectedColor === c
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400 block mb-2">
                  Filter by Season
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSeason(s)}
                      className={`text-xs px-3 py-1.5 min-h-[36px] rounded-md border transition-all ${
                        selectedSeason === s
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Categories Pill Bar */}
          {activeSubTab === 'outfits' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-3.5 py-2 min-h-[40px] rounded-md border whitespace-nowrap transition-all font-medium ${
                    activeCategory === cat
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* VIEW A: TASTEMAKER SEARCH TAB */}
        {activeSubTab === 'creators' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Style Curators & Tastemakers
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {isSearchingUsers ? 'Searching...' : `${searchResults.length} Tastemakers`}
              </span>
            </div>

            {isSearchingUsers ? (
              <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <Sparkles className="w-5 h-5 text-zinc-600 dark:text-zinc-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Searching tastemakers across StyleSphere...</p>
              </div>
            ) : userSearchError ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mb-2">Search error</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{userSearchError}</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <Users className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  {searchQuery ? `No tastemakers found for "${searchQuery}"` : 'Discover Tastemakers'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Try searching with a different username or display name.'
                    : 'Search style curators to follow their aesthetic journey and outfit moments.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {searchResults.map((user) => {
                  const following = isFollowingUser(user.id) || user.isFollowing;
                  const isMe = user.isMe || user.id === currentUser.id;

                  return (
                    <div
                      key={user.id}
                      className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
                    >
                      <div
                        onClick={() => navigate(`/profile/${user.username}`)}
                        className="flex items-start gap-3.5 cursor-pointer min-w-0 flex-1"
                      >
                        <Avatar
                          src={user.avatar}
                          alt={user.displayName}
                          size="md"
                          isVerified={user.isVerified}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {user.displayName}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{user.username}</p>
                          {user.bio && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1 mt-1">
                              {user.bio}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                            <span>
                              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
                                {user.followersCount}
                              </strong>{' '}
                              Followers
                            </span>
                            <span>&middot;</span>
                            <span>
                              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
                                {user.postsCount}
                              </strong>{' '}
                              Posts
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isMe && (
                        <Button
                          size="sm"
                          variant={following ? 'outline' : 'primary'}
                          onClick={() => toggleFollowUser(user.id)}
                          className="text-xs px-3 py-1 flex-shrink-0 min-h-[36px]"
                        >
                          {following ? 'Following' : '+ Follow'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW B: ASYMMETRIC EDITORIAL DISCOVERY MOSAIC */}
        {activeSubTab === 'outfits' && (
          <div className="space-y-6">
            {/* Curators Spotlight Strip */}
            {styleCurators.length > 0 && (
              <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Popular Style Curators
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('creators')}
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {styleCurators.slice(0, 6).map((creator) => {
                    const isFollowing = isFollowingUser(creator.id) || creator.isFollowing;
                    const isMe = creator.id === currentUser.id;

                    return (
                      <div
                        key={creator.id}
                        className="flex items-center justify-between p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
                      >
                        <div
                          onClick={() => navigate(`/profile/${creator.username}`)}
                          className="flex items-center gap-2.5 cursor-pointer min-w-0"
                        >
                          <Avatar src={creator.avatar} alt={creator.name} size="sm" isVerified={creator.isVerified} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {creator.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">@{creator.username}</p>
                          </div>
                        </div>

                        {!isMe && (
                          <Button
                            size="sm"
                            variant={isFollowing ? 'outline' : 'secondary'}
                            onClick={() => toggleFollowUser(creator.id)}
                            className="text-xs min-h-[34px] px-2.5 py-1 ml-2 flex-shrink-0"
                          >
                            {isFollowing ? 'Following' : '+ Follow'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Editorial Discovery Mosaic */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {activeCategory === 'All' ? 'Lookbook Mosaic' : `${activeCategory} Collection`}
                </h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {filteredPosts.length} {filteredPosts.length === 1 ? 'Look' : 'Looks'}
                </span>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Compass className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">
                    No looks found matching your filter
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                    Try searching for "Minimal", "Denim", "Linen", or reset filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveCategory('All');
                      setSelectedColor('All Colors');
                      setSelectedSeason('All Seasons');
                      setSearchQuery('');
                    }}
                    className="mt-4"
                  >
                    Reset All Filters
                  </Button>
                </div>
              ) : (
                <EditorialMosaic posts={filteredPosts} />
              )}
            </div>
          </div>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
