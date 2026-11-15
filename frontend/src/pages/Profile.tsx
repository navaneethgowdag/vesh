import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Sparkles,
  Grid,
  Bookmark,
  FolderHeart,
  MapPin,
  Calendar,
  Clock,
  Trash2,
  Heart,
  RefreshCw,
  PieChart as PieIcon,
  Plus,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PostCard } from '../components/feed/PostCard';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { UserListModal } from '../components/social/UserListModal';
import { StylingProfileManager } from '../components/profile/StylingProfileManager';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { AddMomentModal } from '../components/feed/AddMomentModal';
import { MomentViewerModal } from '../components/feed/MomentViewerModal';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { OutfitMoment, Post } from '../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

export const Profile: React.FC = () => {
  const { posts, wardrobe, collections, showToast, refreshData } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'Styling' | 'Posts' | 'Moments' | 'Saved' | 'Collections'>('Styling');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [userListModalOpen, setUserListModalOpen] = useState(false);
  const [userListInitialTab, setUserListInitialTab] = useState<'followers' | 'following'>('followers');

  // Posts and Moments state
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [myMoments, setMyMoments] = useState<OutfitMoment[]>([]);
  const [isLoadingMoments, setIsLoadingMoments] = useState(false);
  const [isAddMomentOpen, setIsAddMomentOpen] = useState(false);
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

  // Fetch the authenticated user's published posts
  const loadMyPosts = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingPosts(true);
    try {
      const fetched = await api.posts.listByUser(currentUser.id, 50);
      setMyPosts(fetched);
    } catch (err) {
      console.warn('Failed to load user posts, falling back to context:', err);
      setMyPosts(posts.filter((p) => p.user && p.user.id === currentUser.id));
    } finally {
      setIsLoadingPosts(false);
    }
  }, [currentUser?.id, posts]);

  // Fetch the authenticated user's active 24h moments (/moments/me)
  const loadMyMoments = useCallback(async () => {
    setIsLoadingMoments(true);
    try {
      const moments = await api.moments.listMine();
      setMyMoments(moments);
    } catch (err) {
      console.warn('Failed to load user moments:', err);
      setMyMoments([]);
    } finally {
      setIsLoadingMoments(false);
    }
  }, []);

  useEffect(() => {
    loadMyPosts();
    loadMyMoments();
  }, [loadMyPosts, loadMyMoments]);

  const handleDeleteMoment = async (id: string) => {
    try {
      await api.moments.delete(id);
      setMyMoments((prev) => prev.filter((m) => m.id !== id));
      showToast('Outfit moment removed', 'success');
    } catch {
      showToast('Failed to delete moment', 'info');
    }
  };

  const handleDeletePost = (deletedId: string) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  const formatTimeRemaining = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Expiring soon';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  // Wardrobe distribution data
  const categoryData = [
    { name: 'Tops', value: wardrobe.filter((i) => i.category === 'Tops').length, color: '#29202B' },
    { name: 'Bottoms', value: wardrobe.filter((i) => i.category === 'Bottoms').length, color: '#743C49' },
    { name: 'Outerwear', value: wardrobe.filter((i) => i.category === 'Outerwear').length, color: '#B49B82' },
    { name: 'Shoes', value: wardrobe.filter((i) => i.category === 'Shoes').length, color: '#6D7068' },
    { name: 'Accessories', value: wardrobe.filter((i) => i.category === 'Accessories' || i.category === 'Bags').length, color: '#D5A6A0' },
  ].filter((d) => d.value > 0);

  const handleRefresh = async () => {
    await Promise.allSettled([
      refreshData(),
      loadMyPosts(),
      loadMyMoments(),
    ]);
  };

  const savedPosts = posts.filter((p) => p.isSaved);

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Profile Header Card */}
        <div className="bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-6 sm:p-8 mb-8 transition-colors shadow-xs">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <Avatar
              src={currentUser.avatar}
              alt={currentUser.name}
              size="2xl"
              isVerified={currentUser.isVerified}
            />

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
                    {currentUser.name}
                  </h1>
                  <p className="text-xs font-mono text-[#777078] dark:text-[#D5A6A0]">@{currentUser.username}</p>
                </div>

                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditProfileOpen(true)}
                    icon={<Settings className="w-4 h-4" />}
                    className="rounded-[2px] border-[#DCD4CC] dark:border-[#392F3E] uppercase tracking-[0.1em] text-xs"
                  >
                    Edit Profile
                  </Button>
                </div>
              </div>

              {currentUser.bio && (
                <p className="text-sm text-[#29202B] dark:text-[#F3EEE8] max-w-xl leading-relaxed mb-4 font-sans">
                  {currentUser.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#777078] dark:text-[#DCD4CC] mb-6">
                {currentUser.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#743C49]" />
                    {currentUser.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-[#743C49]" />
                  {currentUser.joinedDate}
                </span>
                <span className="flex items-center gap-1.5 text-[#6D7068] dark:text-[#D5A6A0] text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#743C49]" />
                  Private Wardrobe Protected
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
                    {myPosts.length}
                  </span>
                  <span className="text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-medium">Posts</span>
                </button>

                <button
                  type="button"
                  onClick={openFollowersModal}
                  className="text-center sm:text-left group cursor-pointer focus:outline-none min-h-[44px]"
                >
                  <span className="text-3xl font-light font-serif text-[#29202B] dark:text-[#F3EEE8] block group-hover:underline transition-colors">
                    {formatStatCount(currentUser.followersCount || 0)}
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
                    {formatStatCount(currentUser.followingCount || 0)}
                  </span>
                  <span className="text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-medium group-hover:text-[#743C49] transition-colors">
                    Following
                  </span>
                </button>

                <div className="text-center sm:text-left">
                  <span className="text-3xl font-light font-serif text-[#29202B] dark:text-[#F3EEE8] flex items-center gap-1.5">
                    {wardrobe.length}
                    <Lock className="w-3.5 h-3.5 text-[#777078] opacity-70" title="Private capsule" />
                  </span>
                  <span className="text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-medium">Wardrobe</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Style Preferences & Wardrobe Analytics Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          {/* Style Preferences */}
          <div className="md:col-span-7 bg-white dark:bg-[#1F1922] rounded-[3px] p-5 sm:p-6 border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
              <h3 className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#777078] dark:text-[#D5A6A0]">
                Aesthetic Signature
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {currentUser.preferences.styles.map((style) => (
                <span
                  key={style}
                  className="bg-[#FAF6F0] dark:bg-[#201824] text-[#29202B] dark:text-[#F3EEE8] text-[10px] uppercase tracking-[0.1em] font-medium px-3.5 py-1.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E]"
                >
                  {style}
                </span>
              ))}
              <span className="bg-[#FAF6F0] dark:bg-[#201824] text-[#29202B] dark:text-[#F3EEE8] text-[10px] uppercase tracking-[0.1em] font-medium px-3.5 py-1.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E]">
                Neutral Tones
              </span>
            </div>

            <p className="text-xs text-[#777078] dark:text-[#DCD4CC] leading-relaxed font-sans">
              <strong className="text-[#29202B] dark:text-[#F3EEE8] font-semibold">Lifestyle:</strong>{' '}
              {currentUser.preferences.lifestyle}
            </p>
            <p className="text-xs text-[#777078] dark:text-[#DCD4CC] leading-relaxed mt-1 font-sans">
              <strong className="text-[#29202B] dark:text-[#F3EEE8] font-semibold">Staple Pieces:</strong>{' '}
              {currentUser.preferences.staplePieces.join(', ')}
            </p>

            <div className="mt-4 pt-3 border-t border-[#DCD4CC]/60 dark:border-[#392F3E]/60 flex items-center gap-2 text-[11px] text-[#777078] dark:text-[#DCD4CC]">
              <Lock className="w-3 h-3 text-[#743C49]" />
              <span>Personal wardrobe inventory and AI styling models are private and visible only to you.</span>
            </div>
          </div>

          {/* Recharts Capsule Visualizer */}
          <div className="md:col-span-5 bg-white dark:bg-[#1F1922] rounded-[3px] p-5 sm:p-6 border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#777078] dark:text-[#D5A6A0] flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                Capsule Distribution
              </span>
              <span className="text-xs font-mono text-[#777078] dark:text-[#DCD4CC]">{wardrobe.length} Pieces</span>
            </div>

            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={54}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#29202B',
                      borderColor: '#392F3E',
                      borderRadius: '2px',
                      fontSize: '11px',
                      color: '#F3EEE8',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Profile Tabs Navigation */}
        <div className="flex items-center gap-6 border-b border-[#DCD4CC] dark:border-[#392F3E] mb-6 overflow-x-auto hide-scrollbar">
          {[
            { id: 'Styling', label: 'Styling Profile & Routine', count: undefined, icon: Sparkles },
            { id: 'Posts', label: 'Lookbook Posts', count: myPosts.length, icon: Grid },
            { id: 'Moments', label: '24h Moments', count: myMoments.length, icon: Clock },
            { id: 'Saved', label: 'Saved Looks', count: savedPosts.length, icon: Bookmark },
            { id: 'Collections', label: 'Curated Moodboards', count: collections.length, icon: FolderHeart },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 min-h-[44px] text-xs font-medium uppercase tracking-[0.12em] transition-all whitespace-nowrap flex items-center gap-2 relative ${
                  isCurrent
                    ? 'text-[#743C49] dark:text-[#D5A6A0] font-semibold'
                    : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#743C49] dark:text-[#D5A6A0]' : 'text-[#777078]'}`} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="text-[10px] font-mono text-[#777078] ml-0.5">({tab.count})</span>
                )}
                {isCurrent && (
                  <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#743C49] dark:bg-[#D5A6A0]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 0: Dedicated Styling Profile & Weekly Routine */}
        {activeTab === 'Styling' && (
          <div className="mb-12">
            <StylingProfileManager />
          </div>
        )}

        {/* Tab 1: Lookbook Posts */}
        {activeTab === 'Posts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8]">
                  Your Lookbook
                </h2>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">
                  Published outfit stories and lookbook entries
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/create?type=post')}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold"
              >
                Create Post
              </Button>
            </div>

            {isLoadingPosts ? (
              <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
                <RefreshCw className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">Loading your lookbook posts...</p>
              </div>
            ) : myPosts.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 shadow-xs">
                <Grid className="w-8 h-8 text-[#777078] mx-auto mb-2 opacity-60" />
                <h3 className="font-serif text-xl font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                  No Lookbook Posts Yet
                </h3>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto mb-4 font-sans">
                  Publish permanent fashion posts with tagged garments to curate your personal style journal.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/create?type=post')}
                  className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold"
                >
                  Create First Post
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {myPosts.map((post) => (
                  <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 24h Moments */}
        {activeTab === 'Moments' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8]">
                  Active 24-Hour Moments
                </h2>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">
                  Ephemeral outfit captures visible to your followers
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddMomentOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold"
              >
                Share a Moment
              </Button>
            </div>

            {isLoadingMoments ? (
              <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
                <RefreshCw className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">Loading active moments...</p>
              </div>
            ) : myMoments.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 shadow-xs">
                <Clock className="w-8 h-8 text-[#777078] mx-auto mb-2 opacity-60" />
                <h3 className="font-serif text-xl font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                  No Active 24-Hour Moments
                </h3>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto mb-4 font-sans">
                  Capture short-lived outfit moments visible to your followers for 24 hours.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddMomentOpen(true)}
                  className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold"
                >
                  Capture Moment
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {myMoments.map((moment, idx) => (
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

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMoment(moment.id);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-[2px] bg-black/60 text-white hover:bg-[#743C49] transition-colors"
                      title="Delete moment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

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

        {/* Tab 3: Saved Looks */}
        {activeTab === 'Saved' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8]">
                  Saved Curation Archive
                </h2>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">
                  Outfits and editorial looks bookmarked for future inspiration
                </p>
              </div>
            </div>

            {savedPosts.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 shadow-xs">
                <Bookmark className="w-8 h-8 text-[#777078] mx-auto mb-2 opacity-60" />
                <h3 className="font-serif text-xl font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                  Your Saved Curations
                </h3>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto mb-4 font-sans">
                  Bookmark outfits and editorial looks across TailorBird to save them to your private archive.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/discover')}
                  className="rounded-[2px] border-[#DCD4CC] dark:border-[#392F3E] uppercase tracking-[0.14em] text-xs font-semibold"
                >
                  Discover Looks
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {savedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Curated Collections */}
        {activeTab === 'Collections' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8]">
                  Editorial Moodboards & Capsules
                </h2>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC]">
                  Seasonal capsules and themed outfit collections
                </p>
              </div>
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] p-8 shadow-xs">
                <FolderHeart className="w-8 h-8 text-[#777078] mx-auto mb-2 opacity-60" />
                <h3 className="font-serif text-xl font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                  Editorial Moodboard Collections
                </h3>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto mb-4 font-sans">
                  Organize outfits into seasonal capsule collections and moodboards.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/daily-fit?tab=saved')}
                  className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold"
                >
                  Open Collections
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="p-5 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs"
                  >
                    <h4 className="font-serif text-lg font-normal text-[#29202B] dark:text-[#F3EEE8] mb-1">
                      {col.name}
                    </h4>
                    <p className="text-xs text-[#777078] dark:text-[#DCD4CC] line-clamp-2 mb-3">
                      {col.description || 'Curated fashion capsule'}
                    </p>
                    <span className="text-[10px] font-mono text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-wider">
                      {col.outfitIds.length} {col.outfitIds.length === 1 ? 'Outfit' : 'Outfits'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PullToRefresh>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      {/* Followers / Following List Modal */}
      <UserListModal
        isOpen={userListModalOpen}
        onClose={() => setUserListModalOpen(false)}
        userId={currentUser.id}
        initialTab={userListInitialTab}
        username={currentUser.username}
      />

      {/* Add Moment Modal */}
      <AddMomentModal
        isOpen={isAddMomentOpen}
        onClose={() => setIsAddMomentOpen(false)}
        onSuccess={(newMoment) => {
          setMyMoments((prev) => [newMoment, ...prev]);
          setIsAddMomentOpen(false);
          showToast('Outfit moment published successfully!', 'success');
        }}
      />

      {/* Moment Viewer Modal */}
      <MomentViewerModal
        isOpen={viewerOpen}
        moments={myMoments}
        initialIndex={activeMomentIndex}
        onClose={() => setViewerOpen(false)}
      />
    </AppShell>
  );
};
