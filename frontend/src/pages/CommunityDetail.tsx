import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Lock,
  Globe,
  Shield,
  Pin,
  Trash2,
  Send,
  Plus,
  ArrowLeft,
  Share2,
  Check,
  X,
  Sparkles,
  Info,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Community, CommunityMember, CommunityPost } from '../types';

export const CommunityDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { showToast } = useApp();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<CommunityMember[]>([]);
  const [feed, setFeed] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'members'>('feed');

  // Post composer state
  const [postTitle, setPostTitle] = useState('');
  const [postMessage, setPostMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const loadData = async () => {
    if (!slug) return;
    setIsLoading(true);
    try {
      const comm = await api.communities.get(slug);
      setCommunity(comm);

      // Load feed if public or active member
      if (comm.visibility === 'public' || comm.is_member) {
        const [postsData, membersData] = await Promise.all([
          api.communities.getFeed(comm.id).catch(() => []),
          api.communities.getMembers(comm.id, 'active').catch(() => []),
        ]);
        setFeed(postsData);
        setMembers(membersData);

        // If moderator or owner, load pending members for private communities
        if (comm.membership_role === 'owner' || comm.membership_role === 'moderator') {
          const pending = await api.communities.getMembers(comm.id, 'pending').catch(() => []);
          setPendingMembers(pending);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load community', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  const handleJoinLeave = async () => {
    if (!community) return;

    if (community.is_member) {
      if (community.membership_role === 'owner') {
        showToast('As owner, you cannot leave your community', 'error');
        return;
      }
      try {
        await api.communities.leave(community.id);
        showToast('Left community', 'info');
        loadData();
      } catch (err: any) {
        showToast(err?.message || 'Failed to leave community', 'error');
      }
    } else {
      try {
        const res = await api.communities.join(community.id);
        if (res.status === 'requested') {
          showToast('Membership request submitted for approval', 'success');
        } else {
          showToast('Joined community!', 'success');
        }
        loadData();
      } catch (err: any) {
        showToast(err?.message || 'Failed to join community', 'error');
      }
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;
    if (!postTitle.trim() && !postMessage.trim()) {
      showToast('Please enter a message or discussion topic', 'error');
      return;
    }

    setIsPosting(true);
    try {
      await api.communities.createPost(community.id, {
        title: postTitle.trim() || undefined,
        message: postMessage.trim() || undefined,
      });
      setPostTitle('');
      setPostMessage('');
      showToast('Discussion published to community!', 'success');
      // Refresh feed
      const updatedFeed = await api.communities.getFeed(community.id);
      setFeed(updatedFeed);
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish post', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!community) return;
    try {
      await api.communities.deletePost(community.id, postId);
      showToast('Post removed', 'success');
      setFeed((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove post', 'error');
    }
  };

  const handleManageMember = async (targetUserId: string, action: 'approve' | 'reject') => {
    if (!community) return;
    try {
      await api.communities.manageMember(community.id, targetUserId, action);
      showToast(`Member request ${action}d!`, 'success');
      setPendingMembers((prev) => prev.filter((m) => m.user.id !== targetUserId));
      if (action === 'approve') {
        const updatedMembers = await api.communities.getMembers(community.id, 'active');
        setMembers(updatedMembers);
      }
    } catch (err: any) {
      showToast(err?.message || `Failed to ${action} member`, 'error');
    }
  };

  if (isLoading) {
    return (
      <AppShell showRightSidebar={true}>
        <div className="text-center py-24">
          <Sparkles className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-zinc-500">Loading community aesthetic...</p>
        </div>
      </AppShell>
    );
  }

  if (!community) {
    return (
      <AppShell showRightSidebar={true}>
        <div className="text-center py-24">
          <p className="font-bold text-zinc-900 dark:text-zinc-100">Community Not Found</p>
          <Button variant="ghost" onClick={() => navigate('/explore')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Explore
          </Button>
        </div>
      </AppShell>
    );
  }

  const isOwnerOrMod = community.membership_role === 'owner' || community.membership_role === 'moderator';

  return (
    <AppShell showRightSidebar={true}>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Back Link */}
        <button
          onClick={() => navigate('/explore')}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Explore
        </button>

        {/* Community Banner & Header */}
        <div className="rounded-[3px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] bg-white dark:bg-[#1F1922]">
          <div className="h-36 sm:h-48 bg-gradient-to-r from-[#29202B] via-[#1F1922] to-black relative">
            {community.cover_image_url && (
              <img
                src={community.cover_image_url}
                alt={community.name}
                className="w-full h-full object-cover opacity-60"
              />
            )}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.14em] bg-black/70 backdrop-blur-md text-white border border-white/10 flex items-center gap-1.5">
                {community.visibility === 'public' ? (
                  <>
                    <Globe className="w-3 h-3 text-[#D5A6A0]" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-[#B49B82]" /> Private
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-[0.16em] text-[#777078]">
                    {community.category}
                  </span>
                  {community.membership_role && (
                    <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.12em] bg-[#FAF6F0] dark:bg-[#241D27] text-[#743C49] dark:text-[#D5A6A0] border border-[#DCD4CC] dark:border-[#392F3E]">
                      {community.membership_role}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">
                  {community.name}
                </h1>
                <div className="flex items-center gap-3 text-xs font-mono text-[#777078] mt-1.5">
                  <span className="flex items-center gap-1 font-medium text-[#29202B] dark:text-[#F3EEE8]">
                    <Users className="w-3.5 h-3.5 text-[#743C49]" />
                    {community.members_count} members
                  </span>
                  <span>&middot;</span>
                  <span>Created by @{community.owner.username}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {community.rules && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRules(!showRules)}
                    className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
                    icon={<Info className="w-3.5 h-3.5" />}
                  >
                    Guidelines
                  </Button>
                )}

                <Button
                  variant={community.is_member ? 'outline' : 'primary'}
                  size="sm"
                  onClick={handleJoinLeave}
                  className={`rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em] ${
                    !community.is_member ? 'bg-[#743C49] hover:bg-[#5E2F3A] text-[#F3EEE8]' : ''
                  }`}
                >
                  {community.is_member
                    ? community.membership_role === 'owner'
                      ? 'Owner'
                      : 'Joined (Leave)'
                    : community.membership_status === 'pending'
                    ? 'Pending Approval'
                    : community.visibility === 'private'
                    ? 'Request to Join'
                    : '+ Join Community'}
                </Button>
              </div>
            </div>

            {community.description && (
              <p className="text-xs text-[#777078] dark:text-[#DCD4CC] leading-relaxed font-sans">
                {community.description}
              </p>
            )}

            {/* Collapsible Rules Drawer */}
            {showRules && community.rules && (
              <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-xs text-[#777078] dark:text-[#DCD4CC] space-y-1 font-mono">
                <span className="font-semibold block uppercase tracking-[0.14em] text-[#29202B] dark:text-[#F3EEE8] text-[10px]">
                  Community Rules:
                </span>
                <p className="whitespace-pre-line text-xs font-sans">{community.rules}</p>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-t border-[#DCD4CC] dark:border-[#392F3E] px-5 sm:px-6">
            <button
              onClick={() => setActiveTab('feed')}
              className={`py-3 text-[10px] font-mono uppercase tracking-[0.14em] transition-all relative mr-6 cursor-pointer ${
                activeTab === 'feed'
                  ? 'text-[#29202B] dark:text-[#F3EEE8] border-b-2 border-[#743C49] font-bold'
                  : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
              }`}
            >
              Feed & Discussions ({feed.length})
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-3 text-[10px] font-mono uppercase tracking-[0.14em] transition-all relative cursor-pointer ${
                activeTab === 'members'
                  ? 'text-[#29202B] dark:text-[#F3EEE8] border-b-2 border-[#743C49] font-bold'
                  : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
              }`}
            >
              Members ({members.length})
              {pendingMembers.length > 0 && isOwnerOrMod && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-[2px] text-[9px] bg-[#743C49] text-white font-mono">
                  {pendingMembers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: FEED & DISCUSSIONS */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {/* Create Discussion Composer (active members only) */}
            {community.is_member ? (
              <form
                onSubmit={handleCreatePost}
                className="p-4 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3"
              >
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] block">
                  Start a Discussion or Share Style
                </span>
                <input
                  type="text"
                  placeholder="Discussion Topic / Title..."
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-3 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                />
                <textarea
                  rows={2}
                  placeholder="Share outfit thoughts, style advice, or questions with the community..."
                  value={postMessage}
                  onChange={(e) => setPostMessage(e.target.value)}
                  className="w-full bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-3 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49] resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isPosting || (!postTitle.trim() && !postMessage.trim())}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    {isPosting ? 'Posting...' : 'Post to Community'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Join this community to start discussions and share style inspiration.
                </p>
              </div>
            )}

            {/* Posts List */}
            {feed.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Users className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-zinc-900 dark:text-zinc-100">No discussions yet</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Be the first to share an outfit or start a conversation!
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {feed.map((cp) => {
                  const canDelete =
                    isOwnerOrMod || (currentUser && cp.shared_by.id === currentUser.id);

                  return (
                    <div
                      key={cp.id}
                      className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={cp.shared_by.avatar}
                            alt={cp.shared_by.name}
                            size="sm"
                            isVerified={cp.shared_by.is_verified}
                          />
                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              {cp.shared_by.name}
                            </p>
                            <p className="text-[10px] text-zinc-400">@{cp.shared_by.username}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {cp.is_pinned && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                              <Pin className="w-3 h-3" /> Pinned
                            </span>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeletePost(cp.id)}
                              className="text-zinc-400 hover:text-rose-500 transition-colors p-1"
                              title="Delete Post"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {cp.title && (
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {cp.title}
                        </h4>
                      )}

                      {cp.message && (
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                          {cp.message}
                        </p>
                      )}

                      {/* Attached Outfit Post Preview */}
                      {cp.post && (
                        <div
                          onClick={() => navigate(`/home?post=${cp.post?.id}`)}
                          className="flex gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-zinc-400 transition-all"
                        >
                          {cp.post.image_url && (
                            <img
                              src={cp.post.image_url}
                              alt="Outfit"
                              className="w-16 h-16 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase text-zinc-400">
                              Shared Outfit
                            </span>
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 mt-0.5">
                              {cp.post.caption}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MEMBERS & PENDING REQUESTS */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Pending Requests for Owner / Moderator */}
            {isOwnerOrMod && pendingMembers.length > 0 && (
              <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                  Pending Membership Requests ({pendingMembers.length})
                </span>
                <div className="space-y-2">
                  {pendingMembers.map((pm) => (
                    <div
                      key={pm.id}
                      className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={pm.user.avatar} alt={pm.user.name} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {pm.user.name}
                          </p>
                          <p className="text-[10px] text-zinc-400">@{pm.user.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleManageMember(pm.user.id, 'approve')}
                          icon={<Check className="w-3.5 h-3.5" />}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleManageMember(pm.user.id, 'reject')}
                          icon={<X className="w-3.5 h-3.5 text-rose-500" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Members Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                >
                  <div
                    onClick={() => navigate(`/profile/${m.user.username}`)}
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    <Avatar src={m.user.avatar} alt={m.user.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {m.user.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">@{m.user.username}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.role === 'owner'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        : m.role === 'moderator'
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
