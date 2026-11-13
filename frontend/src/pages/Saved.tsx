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
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
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
        <EditorialPageHeader
          eyebrow="CURATION & MOODBOARD VAULT"
          title="Saved &"
          italicTitle="Inspiration."
          description="Curate style inspiration, moodboards, and staple outfits for future seasons."
          actions={
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh saved items"
                className="w-10 h-10 flex items-center justify-center rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] bg-white dark:bg-[#1F1922] hover:bg-[#FAF6F0] dark:hover:bg-[#2A222D] transition-all cursor-pointer shadow-xs"
                aria-label="Refresh saved"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#743C49]' : ''}`} />
              </button>

              <Button
                variant="primary"
                size="md"
                onClick={() => setCreateModalOpen(true)}
                className="rounded-[2px] bg-[#743C49] hover:bg-[#5E2F3A] text-[#F3EEE8] font-mono text-[10px] uppercase tracking-[0.14em]"
                icon={<FolderPlus className="w-3.5 h-3.5" />}
              >
                New Collection
              </Button>
            </div>
          }
        />

        {/* Collections Row */}
        <div className="mb-8">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#777078] mb-3">
            Curated Collections
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {collections.map((col) => (
              <div
                key={col.id}
                onClick={() => setActiveSection('Outfits')}
                className="group cursor-pointer bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] overflow-hidden hover:border-[#743C49] transition-all"
              >
                <div className="aspect-[4/3] bg-[#FAF6F0] dark:bg-[#241D27] overflow-hidden">
                  <img
                    src={col.coverImage}
                    alt={col.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-serif text-base text-[#29202B] dark:text-[#F3EEE8] truncate">
                    {col.name}
                  </h3>
                  <p className="text-[10px] font-mono text-[#777078] mt-0.5">
                    {col.itemCount} outfits saved
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Filter Tabs */}
        <div className="flex items-center gap-2 p-1 bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] mb-8 w-fit">
          {(['All', 'Outfits', 'Clothing', 'Creators'] as const).map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`px-4 py-2 rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em] transition-all cursor-pointer ${
                activeSection === sec
                  ? 'bg-[#29202B] dark:bg-[#FAF6F0] text-[#F3EEE8] dark:text-[#29202B] font-semibold shadow-xs'
                  : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
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
            <h3 className="font-serif text-2xl text-[#29202B] dark:text-[#F3EEE8] mb-4 flex items-center justify-between">
              <span>Saved Outfits</span>
              <span className="text-[10px] font-mono text-[#777078] tracking-[0.14em]">{savedPosts.length} LOOKS</span>
            </h3>

            {savedPosts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] mb-6">
                <Bookmark className="w-8 h-8 text-[#B49B82] mx-auto mb-2" />
                <p className="font-serif text-base text-[#29202B] dark:text-[#F3EEE8]">No saved outfits yet.</p>
                <p className="text-xs text-[#777078] mt-1 font-sans">
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
            <h3 className="font-serif text-2xl text-[#29202B] dark:text-[#F3EEE8] mb-4 flex items-center justify-between">
              <span>Staple Favorite Pieces</span>
              <span className="text-[10px] font-mono text-[#777078] tracking-[0.14em]">{savedClothing.length} PIECES</span>
            </h3>

            {savedClothing.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] mb-6">
                <Shirt className="w-8 h-8 text-[#B49B82] mx-auto mb-2" />
                <p className="font-serif text-base text-[#29202B] dark:text-[#F3EEE8]">No staple garments marked.</p>
                <p className="text-xs text-[#777078] mt-1 font-sans">
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
            <h3 className="font-serif text-2xl text-[#29202B] dark:text-[#F3EEE8] mb-4 flex items-center justify-between">
              <span>Followed Tastemakers</span>
              <span className="text-[10px] font-mono text-[#777078] tracking-[0.14em]">{savedCreators.length} CREATORS</span>
            </h3>

            {savedCreators.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] mb-6">
                <p className="font-serif text-base text-[#29202B] dark:text-[#F3EEE8]">No followed tastemakers yet.</p>
                <p className="text-xs text-[#777078] mt-1 font-sans">
                  Follow tastemakers on Explore or Feed to build your network.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedCreators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => navigate(`/profile/${creator.username}`)}
                    className="flex items-center gap-3 p-3.5 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] cursor-pointer hover:border-[#743C49] shadow-xs transition-all"
                  >
                    <Avatar src={creator.avatar} alt={creator.name} size="md" isVerified={creator.isVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base text-[#29202B] dark:text-[#F3EEE8] truncate">{creator.name}</p>
                      <p className="text-xs text-[#777078] font-mono truncate">@{creator.username}</p>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] bg-[#FAF6F0] dark:bg-[#241D27] text-[#29202B] dark:text-[#F3EEE8] px-3 py-1 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E]">
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
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                Collection Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Summer in Milan, Studio Workwear, Weekend Casual"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-3.5 py-2.5 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49] min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Linen silhouettes, warm earth tones, and lightweight layering..."
                value={collectionDesc}
                onChange={(e) => setCollectionDesc(e.target.value)}
                className="w-full bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-3.5 py-2.5 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49] resize-none min-h-[60px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCD4CC] dark:border-[#392F3E]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!collectionName.trim()}
                className="rounded-[2px] bg-[#743C49] hover:bg-[#5E2F3A] text-[#F3EEE8] font-mono text-[10px] uppercase tracking-[0.14em]"
              >
                Create Collection
              </Button>
            </div>
          </form>
        </Modal>
      </PullToRefresh>
    </AppShell>
  );
};
