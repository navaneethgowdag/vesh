import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Users, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import { SocialUserSummary } from '../../types';
import { api } from '../../services/api';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  initialTab?: 'followers' | 'following';
  followersCount?: number;
  followingCount?: number;
}

export const UserListModal: React.FC<UserListModalProps> = ({
  isOpen,
  onClose,
  userId,
  username,
  initialTab = 'followers',
  followersCount,
  followingCount,
}) => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { toggleFollowUser, isFollowingUser } = useApp();

  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [users, setUsers] = useState<SocialUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set());

  // Reset tab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  const fetchUsers = useCallback(async () => {
    if (!userId || !isOpen) return;
    setIsLoading(true);
    setError(null);
    try {
      const data =
        activeTab === 'followers'
          ? await api.social.getFollowers(userId, 100, 0)
          : await api.social.getFollowing(userId, 100, 0);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, isOpen, activeTab]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleFollow = async (targetUser: SocialUserSummary) => {
    setActionLoadingIds((prev) => new Set(prev).add(targetUser.id));
    try {
      await toggleFollowUser(targetUser.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, isFollowing: !u.isFollowing } : u
        )
      );
    } catch {
      // Toast handled by AppContext
    } finally {
      setActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
    }
  };

  const handleUserClick = (u: SocialUserSummary) => {
    onClose();
    if (u.id === currentUser.id) {
      navigate('/profile');
    } else {
      navigate(`/profile/${u.username}`);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              @{username}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Community styling network
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
          <button
            onClick={() => setActiveTab('followers')}
            className={`py-3 min-h-[44px] text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
              activeTab === 'followers'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Followers</span>
            {followersCount !== undefined && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {followersCount.toLocaleString()}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`py-3 min-h-[44px] text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
              activeTab === 'following'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Following</span>
            {followingCount !== undefined && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {followingCount.toLocaleString()}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-9 pr-3 py-2 min-h-[44px] text-base sm:text-xs rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Modal Body / User List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-600 dark:text-zinc-400" />
              <p className="text-xs">Loading {activeTab}...</p>
            </div>
          ) : error ? (
            <div className="py-10 text-center px-4">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchUsers}>
                Try again
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-2 text-zinc-400">
                {activeTab === 'followers' ? (
                  <Users className="w-6 h-6" />
                ) : (
                  <UserCheck className="w-6 h-6" />
                )}
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {searchQuery
                  ? 'No users match your search'
                  : activeTab === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {searchQuery
                  ? 'Try searching with another name or username'
                  : activeTab === 'followers'
                  ? 'Followers will appear here once other creators follow this lookbook.'
                  : 'Followed style profiles will appear here.'}
              </p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isViewer = u.id === currentUser.id || u.isMe;
              const currentlyFollowing = isFollowingUser(u.id);
              const isActionLoading = actionLoadingIds.has(u.id);

              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div
                    onClick={() => handleUserClick(u)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <Avatar
                      src={u.avatar}
                      alt={u.name || u.username}
                      size="md"
                      isVerified={u.isVerified}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate hover:underline">
                        {u.name || u.username}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        @{u.username}
                      </p>
                    </div>
                  </div>

                  {!isViewer && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => handleToggleFollow(u)}
                      className={`text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-md transition-all border ${
                        currentlyFollowing
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                          : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent hover:bg-zinc-800'
                      }`}
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : currentlyFollowing ? (
                        'Following'
                      ) : (
                        '+ Follow'
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
