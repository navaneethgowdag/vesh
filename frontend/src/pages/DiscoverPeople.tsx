import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Users,
  X,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { UserSearchResult } from '../types';

export const DiscoverPeople: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { toggleFollowUser, isFollowingUser, showToast } = useApp();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Execute search when debounced query changes
  const executeSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await api.users.search(q, 30);
      setResults(data);
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError('Could not complete search. Please try again.');
      showToast('Search request failed', 'error');
    } finally {
      setIsSearching(false);
    }
  }, [showToast]);

  useEffect(() => {
    executeSearch(debouncedQuery);
  }, [debouncedQuery, executeSearch]);

  const handleFollowToggle = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(userId);
    try {
      await toggleFollowUser(userId);
      // Update local result state immediately
      setResults((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const nextFollow = !isFollowingUser(userId);
            return {
              ...u,
              isFollowing: nextFollow,
              followersCount: Math.max(0, (u.followersCount || 0) + (nextFollow ? 1 : -1)),
            };
          }
          return u;
        })
      );
    } catch (err: any) {
      showToast('Could not update relationship', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 select-none">
        {/* Editorial Header */}
        <EditorialPageHeader
          eyebrow="Intentional Social Discovery"
          title="Discover"
          italicTitle="Tastemakers."
          description="Find fellow fashion curators, stylists, and capsule creators by name or username. Wardrobes remain private by default."
        />

        {/* Search Bar Input */}
        <div className="relative">
          <div className="relative flex items-center bg-white dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] shadow-xs focus-within:border-[#743C49] dark:focus-within:border-[#D5A6A0] transition-colors">
            <div className="pl-4 pr-2 text-[#6D7068] dark:text-[#A89E9B]">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or username (e.g. 'sophia' or 'clara')..."
              className="w-full py-4 pr-10 text-sm font-sans bg-transparent text-[#29202B] dark:text-[#F3EEE8] placeholder-[#A89E9B] focus:outline-none"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="pr-4 text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors cursor-pointer"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isSearching && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-[#743C49] dark:text-[#D5A6A0] font-mono">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Searching...</span>
            </div>
          )}
        </div>

        {/* Search States & Results */}
        {searchError && (
          <div className="p-4 rounded-[2px] bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs text-center font-sans">
            {searchError}
          </div>
        )}

        {!debouncedQuery ? (
          /* Initial Empty State */
          <div className="text-center py-20 bg-white dark:bg-[#1A151C] rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto text-[#743C49] dark:text-[#D5A6A0]">
              <Users className="w-6 h-6" />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <h3 className="font-serif text-xl font-bold text-[#29202B] dark:text-[#F3EEE8]">
                Find Style Curators
              </h3>
              <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
                Search intentionally by display name or username to explore their shared public looks and active 24-hour Moments.
              </p>
            </div>
          </div>
        ) : isSearching ? (
          /* Loading Indicator */
          <div className="text-center py-20 space-y-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#743C49] border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
              Querying Atelier Registry...
            </p>
          </div>
        ) : results.length === 0 ? (
          /* No Results Found */
          <div className="text-center py-20 bg-white dark:bg-[#1A151C] rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto text-[#6D7068] dark:text-[#A89E9B]">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-[#29202B] dark:text-[#F3EEE8]">
              No Tastemakers Found
            </h3>
            <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] max-w-sm mx-auto font-sans leading-relaxed">
              We couldn't find anyone matching &ldquo;{debouncedQuery}&rdquo;. Try searching by a different spelling or username.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuery('')}
              className="mt-2 text-xs uppercase tracking-[0.12em]"
            >
              Clear Query
            </Button>
          </div>
        ) : (
          /* Results Grid */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B] px-1">
              <span>{results.length} {results.length === 1 ? 'Curator Found' : 'Curators Found'}</span>
              <span>Direct Profile View</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((user) => {
                const following = isFollowingUser(user.id) || user.isFollowing;
                const isMe = (currentUser && user.id === currentUser.id) || user.isMe;

                return (
                  <div
                    key={user.id}
                    onClick={() => navigate(`/profile/${user.username}`)}
                    className="p-5 bg-white dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49] dark:hover:border-[#D5A6A0] rounded-[2px] flex items-start justify-between gap-4 transition-all shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <Avatar
                        src={user.profileImageUrl || user.avatar}
                        alt={user.displayName || user.username}
                        size="md"
                        isVerified={user.isVerified}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8] truncate group-hover:text-[#743C49] dark:group-hover:text-[#D5A6A0] transition-colors">
                            {user.displayName || user.username}
                          </p>
                          {user.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#6D7068] dark:text-[#A89E9B] truncate">
                          @{user.username}
                        </p>

                        {user.bio && (
                          <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] mt-1.5 line-clamp-2 font-sans">
                            {user.bio}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                          <span>{user.followersCount || 0} Followers</span>
                          <span>·</span>
                          <span>{user.postsCount || 0} Looks</span>
                        </div>
                      </div>
                    </div>

                    {!isMe && (
                      <button
                        onClick={(e) => handleFollowToggle(user.id, e)}
                        disabled={actionLoadingId === user.id}
                        className={`shrink-0 px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-[0.12em] rounded-[2px] transition-all cursor-pointer ${
                          following
                            ? 'border border-[#DCD4CC] dark:border-[#392F3E] text-[#6D7068] dark:text-[#A89E9B] hover:border-rose-400 hover:text-rose-500 bg-[#FAF6F0] dark:bg-[#241D27]'
                            : 'bg-[#29202B] dark:bg-[#F3EEE8] text-white dark:text-[#29202B] hover:bg-[#743C49]'
                        }`}
                      >
                        {actionLoadingId === user.id ? (
                          '...'
                        ) : following ? (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Following</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UserPlus className="w-3 h-3" />
                            <span>Follow</span>
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
