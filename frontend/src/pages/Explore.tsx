import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Flame,
  Users,
  Compass,
  X,
  Heart,
  Bookmark,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { StyleChip } from '../components/ui/StyleChip';
import { useApp, useCurrentUser } from '../context/AppContext';
import { PostCard } from '../components/feed/PostCard';
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
  const { posts, isFollowingUser, toggleFollowUser } = useApp();
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

  // Derive real style curators from existing posts in Neon database for quick spotlight
  const styleCurators = useMemo(() => {
    const map = new Map<string, typeof posts[0]['user']>();
    for (const p of posts) {
      if (p.user && p.user.id && !map.has(p.user.id)) {
        map.set(p.user.id, p.user);
      }
    }
    return Array.from(map.values());
  }, [posts]);

  // Search and filter outfits
  const filteredPosts = useMemo(() => {
    const filtered = posts.filter((post) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCaption = post.caption.toLowerCase().includes(q);
        const matchesUser =
          post.user.name.toLowerCase().includes(q) || post.user.username.toLowerCase().includes(q);
        const matchesTags = post.tags.some((t) => t.toLowerCase().includes(q));
        const matchesOccasion = post.occasion.toLowerCase().includes(q);
        if (!matchesCaption && !matchesUser && !matchesTags && !matchesOccasion) {
          return false;
        }
      }

      // Category filter
      if (activeCategory !== 'All') {
        if (activeCategory === 'Trending') {
          return true;
        } else {
          const matchOccasion = post.occasion.toLowerCase().includes(activeCategory.toLowerCase());
          const matchTag = post.tags.some((t) =>
            t.toLowerCase().includes(activeCategory.toLowerCase())
          );
          if (!matchOccasion && !matchTag) return false;
        }
      }

      return true;
    });

    if (activeCategory === 'Trending') {
      return [...filtered].sort((a, b) => b.likesCount - a.likesCount);
    }
    return filtered;
  }, [posts, searchQuery, activeCategory]);

  return (
    <AppShell showRightSidebar={true}>
      {/* Header & Section Sub-Tabs */}
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
            Explore Fashion & Tastemakers
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Discover community aesthetics, capsule ideas, and creators redefining daily wear.
          </p>
        </div>

        {/* Sub-navigation tabs: Outfits vs Find Tastemakers */}
        <div className="flex items-center gap-3 border-b border-sand-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('outfits')}
            className={`text-xs sm:text-sm font-semibold pb-2 border-b-2 transition-all ${
              activeSubTab === 'outfits'
                ? 'border-charcoal-900 text-charcoal-950 font-bold'
                : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            Outfits & Trends
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('creators')}
            className={`text-xs sm:text-sm font-semibold pb-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'creators'
                ? 'border-charcoal-900 text-charcoal-950 font-bold'
                : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Find Tastemakers</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={
                activeSubTab === 'outfits'
                  ? 'Search outfits, styles, minimal, tailoring, casual...'
                  : 'Search tastemakers by @username or name...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-cream-50 border border-sand-300 rounded-2xl pl-11 pr-10 py-3 text-xs sm:text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50 shadow-soft-sm"
            />
            <Search className="w-5 h-5 text-charcoal-400 absolute left-3.5 top-3.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-3.5 text-charcoal-400 hover:text-charcoal-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {activeSubTab === 'outfits' && (
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="md"
              onClick={() => setShowFilters(!showFilters)}
              icon={<SlidersHorizontal className="w-4 h-4" />}
            >
              Filters
            </Button>
          )}
        </div>

        {/* Filter Drawer / Accordion (for outfits) */}
        {activeSubTab === 'outfits' && showFilters && (
          <div className="p-4 bg-sand-100/90 rounded-2xl border border-sand-200 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal-500 block mb-2">
                Color Palette
              </span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <StyleChip
                    key={c}
                    label={c}
                    size="sm"
                    selected={selectedColor === c}
                    onClick={() => setSelectedColor(c)}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal-500 block mb-2">
                Season
              </span>
              <div className="flex flex-wrap gap-2">
                {SEASONS.map((s) => (
                  <StyleChip
                    key={s}
                    label={s}
                    size="sm"
                    selected={selectedSeason === s}
                    onClick={() => setSelectedSeason(s)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Categories Bar (for outfits) */}
        {activeSubTab === 'outfits' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <StyleChip
                key={cat}
                label={cat}
                selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        )}
      </div>

      {/* VIEW A: TASTEMAKER SEARCH TAB */}
      {activeSubTab === 'creators' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-serif text-lg font-bold text-charcoal-900">
              Style Curators & Tastemakers
            </h3>
            <span className="text-xs text-charcoal-400">
              {isSearchingUsers ? 'Searching...' : `${searchResults.length} Tastemakers`}
            </span>
          </div>

          {isSearchingUsers ? (
            <div className="text-center py-20 bg-cream-50 rounded-3xl border border-sand-200">
              <Sparkles className="w-6 h-6 text-cognac-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-charcoal-500">Searching tastemakers across StyleSphere...</p>
            </div>
          ) : userSearchError ? (
            <div className="text-center py-16 px-4 bg-cream-50 rounded-3xl border border-sand-200">
              <p className="text-xs text-rose-600 font-semibold mb-2">Search error</p>
              <p className="text-xs text-charcoal-500">{userSearchError}</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-20 bg-cream-50 rounded-3xl border border-sand-200">
              <Users className="w-8 h-8 text-cognac-600 mx-auto mb-2 opacity-60" />
              <p className="font-serif font-bold text-charcoal-800">
                {searchQuery ? `No tastemakers found for "${searchQuery}"` : 'Discover Tastemakers'}
              </p>
              <p className="text-xs text-charcoal-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try searching with a different username or display name.'
                  : 'Search style curators to follow their aesthetic journey and following feed.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {searchResults.map((user) => {
                const following = isFollowingUser(user.id) || user.isFollowing;
                const isMe = user.isMe || user.id === currentUser.id;

                return (
                  <div
                    key={user.id}
                    className="p-4 bg-cream-50 rounded-3xl border border-sand-200/90 shadow-soft flex items-start justify-between gap-3 hover:shadow-soft-md transition-all"
                  >
                    <div
                      onClick={() => navigate(`/profile/${user.username}`)}
                      className="flex items-start gap-3.5 cursor-pointer min-w-0 flex-1"
                    >
                      <Avatar
                        src={user.avatar}
                        alt={user.displayName}
                        size="lg"
                        isVerified={user.isVerified}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-serif font-bold text-sm text-charcoal-900 truncate">
                            {user.displayName}
                          </p>
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-sand-200 text-charcoal-700 font-semibold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-charcoal-400 truncate mb-1">
                          @{user.username}
                        </p>
                        {user.bio && (
                          <p className="text-xs text-charcoal-600 line-clamp-2 leading-relaxed mb-2">
                            {user.bio}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-charcoal-500">
                          <span>
                            <strong className="text-charcoal-800 font-semibold">
                              {user.followersCount}
                            </strong>{' '}
                            Followers
                          </span>
                          <span>
                            <strong className="text-charcoal-800 font-semibold">
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
                        className="text-xs px-3 py-1 flex-shrink-0"
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

      {/* VIEW B: OUTFITS & TRENDS TAB */}
      {activeSubTab === 'outfits' && (
        <>
          {/* Popular Creators Spotlight Strip (Real active creators) */}
          {styleCurators.length > 0 && (
            <div className="mb-8 p-5 bg-sand-100/70 rounded-3xl border border-sand-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cognac-700" />
                  <h3 className="font-serif text-base font-bold text-charcoal-900">
                    Popular Style Curators
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('creators')}
                  className="text-xs font-semibold text-cognac-700 hover:underline"
                >
                  View All Tastemakers →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {styleCurators.slice(0, 6).map((creator) => {
                  const isFollowing = isFollowingUser(creator.id) || creator.isFollowing;
                  const isMe = creator.id === currentUser.id;

                  return (
                    <div
                      key={creator.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-cream-50 border border-sand-200/90 shadow-soft-sm hover:shadow-soft transition-all"
                    >
                      <div
                        onClick={() => navigate(`/profile/${creator.username}`)}
                        className="flex items-center gap-3 cursor-pointer min-w-0"
                      >
                        <Avatar src={creator.avatar} alt={creator.name} size="md" isVerified={creator.isVerified} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-charcoal-900 truncate">
                            {creator.name}
                          </p>
                          <p className="text-[11px] text-charcoal-400 truncate">@{creator.username}</p>
                        </div>
                      </div>

                      {!isMe && (
                        <Button
                          size="sm"
                          variant={isFollowing ? 'outline' : 'secondary'}
                          onClick={() => toggleFollowUser(creator.id)}
                          className="text-xs px-3 py-1 ml-2 flex-shrink-0"
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

          {/* Masonry / Grid of Outfit Posts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-bold text-charcoal-900">
                {activeCategory === 'All' ? 'Trending Outfits & Looks' : `${activeCategory} Looks`}
              </h3>
              <span className="text-xs text-charcoal-400">{filteredPosts.length} Results</span>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-20 bg-cream-50 rounded-3xl border border-sand-200">
                <Compass className="w-8 h-8 text-cognac-600 mx-auto mb-2" />
                <p className="font-serif font-bold text-charcoal-800">No outfits found matching your filter</p>
                <p className="text-xs text-charcoal-500 mt-1">
                  Try searching for "Minimal", "Denim", "Tailoring", or reset category.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveCategory('All');
                    setSearchQuery('');
                  }}
                  className="mt-4"
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
};

