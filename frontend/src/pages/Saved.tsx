import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, FolderPlus, Shirt, RefreshCw } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PostCard } from '../components/feed/PostCard';
import { ClothingCard } from '../components/wardrobe/ClothingCard';
import { Avatar } from '../components/ui/Avatar';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';

export const Saved: React.FC = () => {
  const { posts, wardrobe, collections, createCollection, refreshData } = useApp();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<'All' | 'Outfits' | 'Clothing' | 'Creators'>('All');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDesc, setCollectionDesc] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const savedPosts = posts.filter((p) => p.isSaved);
  const savedClothing = wardrobe.filter((w) => w.isFavorite);
  const savedCreators = React.useMemo(() => {
    const map = new Map<string, typeof posts[0]['user']>();
    for (const p of posts) {
      if (p.user && p.user.isFollowing && !map.has(p.user.id)) {
        map.set(p.user.id, p.user);
      }
    }
    return Array.from(map.values());
  }, [posts]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionName.trim()) return;

    await createCollection(collectionName.trim(), collectionDesc.trim());
    setCollectionName('');
    setCollectionDesc('');
    setCreateModalOpen(false);
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md border border-zinc-200 dark:border-zinc-700">
                <Bookmark className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Saved & Moodboards
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Curate style inspiration, moodboards, and staple outfits for future seasons.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh saved items"
              className="w-11 h-11 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
              aria-label="Refresh saved"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zinc-900 dark:text-zinc-100' : ''}`} />
            </button>

            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              icon={<FolderPlus className="w-4 h-4" />}
            >
              New Collection
            </Button>
          </div>
        </div>

        {/* Collections Row */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            Curated Collections
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {collections.map((col) => (
              <div
                key={col.id}
                onClick={() => setActiveSection('Outfits')}
                className="group cursor-pointer bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
              >
                <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <img
                    src={col.coverImage}
                    alt={col.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {col.name}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {col.itemCount} outfits saved
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Filter Tabs */}
        <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 mb-6">
          {(['All', 'Outfits', 'Clothing', 'Creators'] as const).map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`h-11 px-1 text-sm font-semibold tracking-wide transition-all relative cursor-pointer ${
                activeSection === sec
                  ? 'text-zinc-900 dark:text-zinc-100 font-bold border-b-2 border-zinc-900 dark:border-zinc-100 -mb-px'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {sec} {sec === 'Outfits' ? `(${savedPosts.length})` : sec === 'Clothing' ? `(${savedClothing.length})` : ''}
            </button>
          ))}
        </div>

        {/* Content Displays */}
        {/* 1. Outfits section */}
        {(activeSection === 'All' || activeSection === 'Outfits') && (
          <div className="mb-10">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center justify-between">
              <span>Saved Outfits</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">{savedPosts.length} Looks</span>
            </h3>

            {savedPosts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 mb-6">
                <Bookmark className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No saved outfits yet.</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Discover a look you love on the Feed or Explore and bookmark it here.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {savedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Clothing section */}
        {(activeSection === 'All' || activeSection === 'Clothing') && (
          <div className="mb-10">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center justify-between">
              <span>Staple Favorite Pieces</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">{savedClothing.length} Pieces</span>
            </h3>

            {savedClothing.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 mb-6">
                <Shirt className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No staple garments marked.</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Mark your most versatile pieces as favorites in your Digital Wardrobe.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {savedClothing.map((item) => (
                  <ClothingCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Creators section */}
        {(activeSection === 'All' || activeSection === 'Creators') && (
          <div className="mb-10">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center justify-between">
              <span>Followed Tastemakers</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">{savedCreators.length} Creators</span>
            </h3>

            {savedCreators.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 mb-6">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No followed tastemakers yet.</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Follow tastemakers on Explore or Feed to build your network.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedCreators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => navigate(`/profile/${creator.username}`)}
                    className="flex items-center gap-3 p-3.5 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 shadow-sm transition-all"
                  >
                    <Avatar src={creator.avatar} alt={creator.name} size="md" isVerified={creator.isVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{creator.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{creator.username}</p>
                    </div>
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-3 py-1 rounded-md font-medium border border-zinc-200 dark:border-zinc-700">
                      Profile
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New Collection Modal */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New Collection"
          subtitle="Organize looks for trips, seasonal transitions, or capsule projects"
          maxWidth="md"
        >
          <form onSubmit={handleCreateCollection} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Collection Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Summer in Milan, Studio Workwear, Weekend Casual"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Linen silhouettes, warm earth tones, and lightweight layering..."
                value={collectionDesc}
                onChange={(e) => setCollectionDesc(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none min-h-[60px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={!collectionName.trim()}>
                Create Collection
              </Button>
            </div>
          </form>
        </Modal>
      </PullToRefresh>
    </AppShell>
  );
};
