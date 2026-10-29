import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Calendar,
  Grid,
  Share2,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PostCard } from '../components/feed/PostCard';
import { UserListModal } from '../components/social/UserListModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { User } from '../types';

export const UserProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { posts, isFollowingUser, toggleFollowUser, showToast } = useApp();

  const [creator, setCreator] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Outfits' | 'Saved'>('Outfits');
  const [userListModalOpen, setUserListModalOpen] = useState(false);
  const [userListInitialTab, setUserListInitialTab] = useState<'followers' | 'following'>('followers');

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
    } catch {
      setCreator(null);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadCreator();
  }, [loadCreator]);

  const creatorPosts = posts.filter(
    (p) => creator && p.user && (p.user.id === creator.id || p.user.username === creator.username)
  );

  const isFollowing = creator ? isFollowingUser(creator.id) : false;

  return (
    <AppShell>
      <PullToRefresh onRefresh={loadCreator}>
        {/* Back Button Bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Profile link copied to clipboard', 'info');
            }}
            className="p-2 rounded-xl border border-[#E5DED3] dark:border-[#393832] bg-[#FFFFFF] dark:bg-[#22221F] text-[#82796F] hover:text-[#25211E] dark:hover:text-[#F4F0E8] shadow-subtle transition-colors"
            title="Share profile"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-24">
            <RefreshCw className="w-6 h-6 text-[#C3A36B] animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#82796F]">Loading tastemaker profile...</p>
          </div>
        ) : !creator ? (
          <div className="text-center py-20 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] shadow-subtle p-8 max-w-md mx-auto">
            <h3 className="font-serif text-xl font-medium text-[#25211E] dark:text-[#F4F0E8] mb-2">
              Curator Not Found
            </h3>
            <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mb-6 font-sans">
              The style profile for @{username} does not exist or has been relocated.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigate('/explore')}>
              Explore Tastemakers
            </Button>
          </div>
        ) : (
          <>
            {/* Profile Header Card */}
            <div className="bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] p-6 sm:p-8 shadow-subtle mb-8 transition-colors">
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
                      <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#25211E] dark:text-[#F4F0E8] tracking-tight">
                        {creator.name}
                      </h1>
                      <p className="text-xs sm:text-sm text-[#82796F] dark:text-[#B2AA9E]">@{creator.username}</p>
                    </div>

                    <Button
                      variant={isFollowing ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => toggleFollowUser(creator.id)}
                      className="min-w-[110px]"
                    >
                      {isFollowing ? 'Following' : '+ Follow'}
                    </Button>
                  </div>

                  {creator.bio && (
                    <p className="text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] max-w-xl leading-relaxed mb-4 font-sans font-light">
                      {creator.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#82796F] dark:text-[#B2AA9E] mb-6">
                    {creator.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#C3A36B] dark:text-[#D1B47A]" />
                        {creator.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#C3A36B] dark:text-[#D1B47A]" />
                      Member since {creator.joinedDate}
                    </span>
                  </div>

                  {/* Social Stats Row */}
                  <div className="flex items-center justify-center sm:justify-start gap-8 pt-4 border-t border-[#E5DED3] dark:border-[#393832]">
                    <div className="text-center sm:text-left">
                      <span className="font-serif text-xl sm:text-2xl font-bold text-[#25211E] dark:text-[#F4F0E8] block">
                        {creatorPosts.length}
                      </span>
                      <span className="text-[10px] text-[#82796F] dark:text-[#B2AA9E] uppercase font-semibold">Posts</span>
                    </div>

                    <button
                      type="button"
                      onClick={openFollowersModal}
                      className="text-center sm:text-left group cursor-pointer focus:outline-none"
                    >
                      <span className="font-serif text-xl sm:text-2xl font-bold text-[#25211E] dark:text-[#F4F0E8] block group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
                        {formatStatCount(creator.followersCount || 0)}
                      </span>
                      <span className="text-[10px] text-[#82796F] dark:text-[#B2AA9E] uppercase font-semibold group-hover:text-[#25211E] dark:group-hover:text-[#F4F0E8] transition-colors">
                        Followers
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={openFollowingModal}
                      className="text-center sm:text-left group cursor-pointer focus:outline-none"
                    >
                      <span className="font-serif text-xl sm:text-2xl font-bold text-[#25211E] dark:text-[#F4F0E8] block group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
                        {formatStatCount(creator.followingCount || 0)}
                      </span>
                      <span className="text-[10px] text-[#82796F] dark:text-[#B2AA9E] uppercase font-semibold group-hover:text-[#25211E] dark:group-hover:text-[#F4F0E8] transition-colors">
                        Following
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lookbook Posts Section */}
            <div className="mb-6 flex items-center justify-between border-b border-[#E5DED3] dark:border-[#393832] pb-3">
              <h2 className="font-serif text-lg font-medium text-[#25211E] dark:text-[#F4F0E8]">
                Curated Lookbook
              </h2>
              <span className="text-xs text-[#82796F] dark:text-[#B2AA9E]">
                {creatorPosts.length} {creatorPosts.length === 1 ? 'Look' : 'Looks'}
              </span>
            </div>

            {creatorPosts.length === 0 ? (
              <div className="text-center py-20 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl border border-[#E5DED3] dark:border-[#393832] shadow-subtle">
                <Grid className="w-8 h-8 text-[#C3A36B] dark:text-[#D1B47A] mx-auto mb-2 opacity-60" />
                <p className="font-serif font-medium text-[#25211E] dark:text-[#F4F0E8]">
                  No Public Looks Yet
                </p>
                <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-1 font-sans">
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

            {/* Followers / Following List Modal */}
            <UserListModal
              isOpen={userListModalOpen}
              onClose={() => setUserListModalOpen(false)}
              userId={creator.id}
              initialTab={userListInitialTab}
              username={creator.username}
            />
          </>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
