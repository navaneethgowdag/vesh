import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Grid,
  Share2,
  RefreshCw,
  Clock,
  Heart,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PostCard } from '../components/feed/PostCard';
import { UserListModal } from '../components/social/UserListModal';
import { MomentViewerModal } from '../components/feed/MomentViewerModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { User, Post, OutfitMoment } from '../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

export const UserProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { posts, isFollowingUser, toggleFollowUser, showToast } = useApp();

  const [creator, setCreator] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userListModalOpen, setUserListModalOpen] = useState(false);
  const [userListInitialTab, setUserListInitialTab] = useState<'followers' | 'following'>('followers');

  // Posts and Moments state
  const [creatorPosts, setCreatorPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [creatorMoments, setCreatorMoments] = useState<OutfitMoment[]>([]);
  const [isLoadingMoments, setIsLoadingMoments] = useState(false);
  const [activeTab, setActiveTab] = useState<'Posts' | 'Moments'>('Posts');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeMomentIndex, setActiveMomentIndex] = useState(0);

  const formatStatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 10000) return `${(count / 1000).toFixed(1)}k`;
    return count.toLocaleString();
  };

  const openFollowersModal = () => {
    setUserListInitialTab('followers');
    setUserListModalOpen(true);
  };

  const openFollowingModal = () => {
    setUserListInitialTab('following');
    setUserListModalOpen(true);
  };

  const loadCreator = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    try {
      const u = await api.users.getByUsername(username);
      setCreator(u);

      // Fetch creator's published posts
      setIsLoadingPosts(true);
      try {
        const fetchedPosts = await api.posts.listByUser(u.id, 50);
        setCreatorPosts(fetchedPosts);
      } catch (err) {
        console.warn('Failed to load user posts by ID, falling back to feed filter:', err);
        setCreatorPosts(
          posts.filter(
            (p) => p.user && (p.user.id === u.id || p.user.username === u.username)
          )
        );
      } finally {
        setIsLoadingPosts(false);
      }

      // Fetch creator's active moments
      setIsLoadingMoments(true);
      try {
        const fetchedMoments = await api.moments.listByUser(u.id);
        setCreatorMoments(fetchedMoments);
      } catch {
        // Moments may be private to followers or unavailable
        setCreatorMoments([]);
      } finally {
        setIsLoadingMoments(false);
      }
    } catch {
      setCreator(null);
    } finally {
      setIsLoading(false);
    }
  }, [username, posts]);

  useEffect(() => {
    loadCreator();
  }, [loadCreator]);

  const isFollowing = creator ? isFollowingUser(creator.id) : false;

  const handleToggleFollow = async () => {
    if (!creator) return;
    const wasFollowing = isFollowing;
    try {
      await toggleFollowUser(creator.id);
      setCreator((prev) =>
        prev
          ? {
              ...prev,
              followersCount: wasFollowing
                ? Math.max(0, (prev.followersCount || 1) - 1)
                : (prev.followersCount || 0) + 1,
            }
          : null
      );
      // If now following, re-attempt moments fetch
      if (!wasFollowing) {
        try {
          const fetchedMoments = await api.moments.listByUser(creator.id);
          setCreatorMoments(fetchedMoments);
        } catch {
          // Ignore
        }
      }
    } catch {
      showToast('Failed to update follow status', 'info');
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Expiring soon';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={loadCreator}>
        {/* Back Button Bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 min-h-[42px] text-xs font-semibold uppercase tracking-[0.1em] text-[#777078] hover:text-[#743C49] dark:hover:text-[#D5A6A0] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Profile link copied to clipboard', 'info');
            }}
            className="p-2 min-h-[42px] min-w-[42px] rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-white dark:bg-[#1F1922] text-[#777078] hover:text-[#743C49] transition-colors flex items-center justify-center shadow-xs cursor-pointer"
            title="Share profile"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-24 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
            <RefreshCw className="w-6 h-6 text-[#743C49] dark:text-[#D5A6A0] animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">Loading tastemaker profile...</p>
          </div>
        ) : !creator ? (
          <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 max-w-md mx-auto shadow-xs">
            <h3 className="text-2xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8] mb-2">
              Curator Not Found
            </h3>
            <p className="text-xs text-[#777078] dark:text-[#DCD4CC] mb-6 font-sans">
              The style profile for @{username} does not exist or has been relocated.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/discover')}
              className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold"
            >
              Discover Tastemakers
            </Button>
          </div>
        ) : (
          <>
            {/* Profile Header Card */}
            <div className="bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-6 sm:p-8 mb-8 transition-colors shadow-xs">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                <Avatar
                  src={creator.avatar}
                  alt={creator.name}
                  size="2xl"
                  isVerified={creator.isVerified}
                />

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
                        {creator.name}
                      </h1>
                      <p className="text-xs font-mono text-[#777078] dark:text-[#D5A6A0]">@{creator.username}</p>
                    </div>

                    <Button
                      variant={isFollowing ? 'outline' : 'primary'}
                      size="sm"
                      onClick={handleToggleFollow}
                      className={`min-w-[110px] rounded-[2px] uppercase tracking-[0.14em] text-xs font-semibold ${
                        isFollowing
                          ? 'border-[#DCD4CC] dark:border-[#392F3E]'
                          : 'bg-[#743C49] hover:bg-[#5b2f3a] text-white'
                      }`}
                    >
                      {isFollowing ? 'Following' : '+ Follow'}
                    </Button>
                  </div>

                  {creator.bio && (
                    <p className="text-sm text-[#29202B] dark:text-[#F3EEE8] max-w-xl leading-relaxed mb-4 font-sans">
                      {creator.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#777078] dark:text-[#DCD4CC] mb-6">
                    {creator.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#743C49]" />
                        {creator.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#743C49]" />
                      Member since {creator.joinedDate}
                    </span>
                    <span className="flex items-center gap-1.5 text-[#6D7068] dark:text-[#D5A6A0] text-[11px]">
                      <Lock className="w-3 h-3 text-[#743C49]" />
                      Wardrobe Private
                    </span>
                  </div>

                  {/* Social Stats Row */}
                  <div className="flex items-center justify-center sm:justify-start gap-8 pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E]">
                    <button
                      type="button"
                      onClick={() => setActiveTab('Posts')}
                      className="text-center sm:text-left group cursor-pointer focus:outline-none min-h-[44px]"
                    >
                      <span className="text-3xl font-light font-serif text-[#29202B] dark:text-[#F3EEE8] block group-hover:text-[#743C49] transition-colors">
                        {creatorPosts.length}
                      </span>
                      <span className="text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-medium">Posts</span>
                    </button>

                    <button
                      type="button"
                      onClick={openFollowersModal}
                      className="text-center sm:text-left group cursor-pointer focus:outline-none min-h-[44px]"
                    >
                      <span className="text-3xl font-light font-serif text-[#29202B] dark:text-[#F3EEE8] block group-hover:underline transition-colors">
                        {formatStatCount(creator.followersCount || 0)}
                      </span>
                      <span className="text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-medium group-hover:text-[#743C49] transition-colors">
                        Followers
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={openFollowingModal}
                      className="text-center sm:text-left group cursor-pointer focus:outline-none min-h-[44px]"
                    >
                      <span className="text-3xl font-light font-serif text-[#29202B] dark:text-[#F3EEE8] block group-hover:underline transition-colors">
                        {formatStatCount(creator.followingCount || 0)}
                      </span>
                      <span className="text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-medium group-hover:text-[#743C49] transition-colors">
                        Following
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Wardrobe Privacy Assurance Banner */}
            <div className="mb-8 p-4 bg-[#FAF6F0] dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0] shrink-0" />
              <p className="text-xs text-[#777078] dark:text-[#DCD4CC] leading-relaxed">
                <strong className="text-[#29202B] dark:text-[#F3EEE8] font-medium">Personal Wardrobe is Private:</strong> In TailorBird, individual wardrobe inventories, internal garment analysis, and AI styling schedules are strictly confidential and visible only to the account owner.
              </p>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex items-center gap-6 border-b border-[#DCD4CC] dark:border-[#392F3E] mb-6 overflow-x-auto hide-scrollbar">
              {[
                { id: 'Posts', label: 'Lookbook Posts', count: creatorPosts.length, icon: Grid },
                { id: 'Moments', label: '24h Moments', count: creatorMoments.length, icon: Clock },
              ].map((tab) => {
                const Icon = tab.icon;
                const isCurrent = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 min-h-[44px] text-xs font-medium uppercase tracking-[0.12em] transition-all whitespace-nowrap flex items-center gap-2 relative cursor-pointer ${
                      isCurrent
                        ? 'text-[#743C49] dark:text-[#D5A6A0] font-semibold'
                        : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#743C49] dark:text-[#D5A6A0]' : 'text-[#777078]'}`} />
                    <span>{tab.label}</span>
                    <span className="text-[10px] font-mono text-[#777078] ml-0.5">({tab.count})</span>
                    {isCurrent && (
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#743C49] dark:bg-[#D5A6A0]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Lookbook Posts Section */}
            {activeTab === 'Posts' && (
              <div>
                {isLoadingPosts ? (
                  <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
                    <RefreshCw className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0] animate-spin mx-auto mb-2" />
                    <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">Loading tastemaker posts...</p>
                  </div>
                ) : creatorPosts.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 shadow-xs">
                    <Grid className="w-8 h-8 text-[#777078] mx-auto mb-2 opacity-60" />
                    <h3 className="font-serif text-xl font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                      No Public Looks Yet
                    </h3>
                    <p className="text-xs text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto font-sans">
                      @{creator.username} has not published any public lookbook ensembles.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {creatorPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: 24h Moments Section */}
            {activeTab === 'Moments' && (
              <div>
                {isLoadingMoments ? (
                  <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
                    <RefreshCw className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0] animate-spin mx-auto mb-2" />
                    <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">Loading active moments...</p>
                  </div>
                ) : creatorMoments.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 shadow-xs">
                    <Clock className="w-8 h-8 text-[#777078] mx-auto mb-2 opacity-60" />
                    <h3 className="font-serif text-xl font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                      No Active 24-Hour Moments
                    </h3>
                    <p className="text-xs text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto font-sans">
                      @{creator.username} has no active outfit moments at this time. Moments expire after 24 hours.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {creatorMoments.map((moment, idx) => (
                      <div
                        key={moment.id}
                        className="relative bg-[#29202B] rounded-[3px] overflow-hidden aspect-[4/5] border border-[#DCD4CC] dark:border-[#392F3E] group shadow-xs cursor-pointer"
                        onClick={() => {
                          setActiveMomentIndex(idx);
                          setViewerOpen(true);
                        }}
                      >
                        <img
                          src={resolveImageUrl(moment.imageUrl) || FALLBACK_POST_IMAGE}
                          alt={moment.caption || 'Outfit moment'}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-[2px] bg-black/60 text-white backdrop-blur-md text-[11px] font-semibold flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#D5A6A0]" />
                          <span>{formatTimeRemaining(moment.timeRemainingSeconds)}</span>
                        </div>

                        <div className="absolute bottom-3 inset-x-3 text-white">
                          {moment.caption && (
                            <p className="text-xs line-clamp-1 mb-1 font-sans">{moment.caption}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-white/80 font-mono">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-[#D5A6A0] fill-[#D5A6A0]" />
                              {moment.likesCount}
                            </span>
                            {moment.occasion && (
                              <span className="text-[10px] uppercase tracking-wider text-white/60">
                                · {moment.occasion}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Followers / Following List Modal */}
            <UserListModal
              isOpen={userListModalOpen}
              onClose={() => setUserListModalOpen(false)}
              userId={creator.id}
              initialTab={userListInitialTab}
              username={creator.username}
            />

            {/* Moment Viewer Modal */}
            <MomentViewerModal
              isOpen={viewerOpen}
              moments={creatorMoments}
              initialIndex={activeMomentIndex}
              onClose={() => setViewerOpen(false)}
            />
          </>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
