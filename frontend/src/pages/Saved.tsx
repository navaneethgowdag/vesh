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
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-luxury-champagne/15 text-luxury-champagne dark:text-luxury-dark-champagne rounded-xl border border-luxury-champagne/30">
                <Bookmark className="w-4 h-4" />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-luxury-text dark:text-luxury-dark-text">
                Saved & Moodboards
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
              Curate style inspiration, moodboards, and staple outfits for future seasons.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh saved items"
              className="p-2.5 rounded-full border border-luxury-border dark:border-luxury-dark-border text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text bg-luxury-surface dark:bg-luxury-dark-surface hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle transition-all cursor-pointer shadow-soft-xs"
              aria-label="Refresh saved"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-luxury-champagne' : ''}`} />
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-3">
            Curated Collections
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {collections.map((col) => (
              <div
                key={col.id}
                onClick={() => setActiveSection('Outfits')}
                className="group cursor-pointer bg-luxury-surface dark:bg-luxury-dark-surface rounded-2xl border border-luxury-border dark:border-luxury-dark-border overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-luxury-champagne/50 transition-all"
              >
                <div className="aspect-[4/3] bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle overflow-hidden">
                  <img
                    src={col.coverImage}
                    alt={col.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-serif font-bold text-xs text-luxury-text dark:text-luxury-dark-text truncate group-hover:text-luxury-champagne">
                    {col.name}
                  </h3>
                  <p className="text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-0.5">
                    {col.itemCount} outfits saved
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Filter Tabs */}
        <div className="flex items-center gap-4 border-b border-luxury-border dark:border-luxury-dark-border mb-6">
          {(['All', 'Outfits', 'Clothing', 'Creators'] as const).map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative cursor-pointer ${
                activeSection === sec
                  ? 'text-luxury-text dark:text-luxury-dark-text font-bold border-b-2 border-luxury-champagne dark:border-luxury-dark-champagne -mb-px'
                  : 'text-luxury-textMuted dark:text-luxury-dark-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text'
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
            <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text mb-4 flex items-center justify-between">
              <span>Saved Outfits</span>
              <span className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted font-normal">{savedPosts.length} Looks</span>
            </h3>

            {savedPosts.length === 0 ? (
              <div className="text-center py-12 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border mb-6">
                <Bookmark className="w-8 h-8 text-luxury-champagne/40 mx-auto mb-2" />
                <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text">No saved outfits yet.</p>
                <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
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
            <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text mb-4 flex items-center justify-between">
              <span>Staple Favorite Pieces</span>
              <span className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted font-normal">{savedClothing.length} Pieces</span>
            </h3>

            {savedClothing.length === 0 ? (
              <div className="text-center py-12 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border mb-6">
                <Shirt className="w-8 h-8 text-luxury-champagne/40 mx-auto mb-2" />
                <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text">No staple garments marked.</p>
                <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
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
            <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text mb-4 flex items-center justify-between">
              <span>Followed Tastemakers</span>
              <span className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted font-normal">{savedCreators.length} Creators</span>
            </h3>

            {savedCreators.length === 0 ? (
              <div className="text-center py-12 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border mb-6">
                <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text">No followed tastemakers yet.</p>
                <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
                  Follow tastemakers on Explore or Feed to build your network.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedCreators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => navigate(`/profile/${creator.username}`)}
                    className="flex items-center gap-3 p-3.5 bg-luxury-surface dark:bg-luxury-dark-surface rounded-2xl border border-luxury-border dark:border-luxury-dark-border cursor-pointer hover:border-luxury-champagne/50 shadow-soft-xs transition-all"
                  >
                    <Avatar src={creator.avatar} alt={creator.name} size="md" isVerified={creator.isVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text truncate">{creator.name}</p>
                      <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted truncate">@{creator.username}</p>
                    </div>
                    <span className="text-[11px] bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text px-3 py-1 rounded-full font-medium border border-luxury-border dark:border-luxury-dark-border">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1.5">
                Collection Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Summer in Milan, Studio Workwear, Weekend Casual"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-2xl px-3.5 py-2.5 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1.5">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Linen silhouettes, warm earth tones, and lightweight layering..."
                value={collectionDesc}
                onChange={(e) => setCollectionDesc(e.target.value)}
                className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-2xl px-3.5 py-2 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-luxury-border dark:border-luxury-dark-border">
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
