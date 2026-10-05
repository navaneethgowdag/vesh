import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { StyleChip } from '../components/ui/StyleChip';
import { useApp } from '../context/AppContext';
import { PostCard } from '../components/feed/PostCard';

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
  const { posts, allCreators, isFollowingUser, toggleFollowUser } = useApp();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedColor, setSelectedColor] = useState('All Colors');
  const [selectedSeason, setSelectedSeason] = useState('All Seasons');
  const [showFilters, setShowFilters] = useState(false);

  // Search and filter outfits
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
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
          if (post.likesCount < 600) return false;
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
  }, [posts, searchQuery, activeCategory]);

  return (
    <AppShell showRightSidebar={true}>
      {/* Header & Search Bar */}
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
            Explore Fashion & Tastemakers
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Discover community aesthetics, capsule ideas, and creators redefining daily wear.
          </p>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search outfits, styles, creators, denim, minimal..."
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

          <Button
            variant={showFilters ? 'primary' : 'outline'}
            size="md"
            onClick={() => setShowFilters(!showFilters)}
            icon={<SlidersHorizontal className="w-4 h-4" />}
          >
            Filters
          </Button>
        </div>

        {/* Filter Drawer / Accordion */}
        {showFilters && (
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

        {/* Categories Bar */}
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
      </div>

      {/* Popular Creators Spotlight Strip */}
      <div className="mb-8 p-5 bg-sand-100/70 rounded-3xl border border-sand-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cognac-700" />
            <h3 className="font-serif text-base font-bold text-charcoal-900">
              Popular Style Curators
            </h3>
          </div>
          <span className="text-xs text-charcoal-500">Verified tastemakers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allCreators.map((creator) => {
            const isFollowing = isFollowingUser(creator.id);

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
                    <p className="text-[10px] text-cognac-700 font-medium truncate mt-0.5">
                      {creator.preferences.styles[0]} · {creator.followersCount} followers
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isFollowing ? 'outline' : 'secondary'}
                  onClick={() => toggleFollowUser(creator.id)}
                  className="text-xs px-3 py-1 ml-2 flex-shrink-0"
                >
                  {isFollowing ? 'Following' : '+ Follow'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

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
    </AppShell>
  );
};

