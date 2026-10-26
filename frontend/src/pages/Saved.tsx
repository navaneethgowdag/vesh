import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Plus, FolderPlus, Sparkles, Heart, Users, Shirt } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PostCard } from '../components/feed/PostCard';
import { ClothingCard } from '../components/wardrobe/ClothingCard';
import { Avatar } from '../components/ui/Avatar';
import { useApp } from '../context/AppContext';

export const Saved: React.FC = () => {
  const { posts, wardrobe, collections, createCollection } = useApp();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<'All' | 'Outfits' | 'Clothing' | 'Creators'>('All');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDesc, setCollectionDesc] = useState('');

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

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionName.trim()) return;

    createCollection(collectionName.trim(), collectionDesc.trim());
    setCollectionName('');
    setCollectionDesc('');
    setCreateModalOpen(false);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cognac-600 text-cream-50 rounded-xl shadow-soft">
              <Bookmark className="w-4 h-4" />
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
              Saved & Moodboards
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Curate style inspiration, moodboards, and staple outfits for future seasons.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setCreateModalOpen(true)}
          icon={<FolderPlus className="w-4 h-4" />}
        >
          New Collection
        </Button>
      </div>

      {/* Collections Row */}
      <div className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-400 mb-3">
          Curated Collections
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              onClick={() => setActiveSection('Outfits')}
              className="group cursor-pointer bg-cream-50 rounded-2xl border border-sand-200 overflow-hidden shadow-soft hover:shadow-soft-lg transition-all"
            >
              <div className="aspect-[4/3] bg-sand-200 overflow-hidden">
                <img
                  src={col.coverImage}
                  alt={col.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-3">
                <h3 className="font-serif font-bold text-xs text-charcoal-900 truncate group-hover:text-cognac-700">
                  {col.name}
                </h3>
                <p className="text-[10px] text-charcoal-500 mt-0.5">
                  {col.itemCount} outfits saved
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section Filter Tabs */}
      <div className="flex items-center gap-4 border-b border-sand-200 mb-6">
        {(['All', 'Outfits', 'Clothing', 'Creators'] as const).map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeSection === sec
                ? 'text-charcoal-950 font-bold border-b-2 border-charcoal-900 -mb-px'
                : 'text-charcoal-400 hover:text-charcoal-700'
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
          <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-4 flex items-center justify-between">
            <span>Saved Outfits</span>
            <span className="text-xs text-charcoal-400 font-normal">{savedPosts.length} Looks</span>
          </h3>

          {savedPosts.length === 0 ? (
            <div className="text-center py-12 bg-cream-50 rounded-3xl border border-sand-200 mb-6">
              <Bookmark className="w-8 h-8 text-sand-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-charcoal-800">No saved outfits yet.</p>
              <p className="text-[11px] text-charcoal-400 mt-1">
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
          <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-4 flex items-center justify-between">
            <span>Staple Favorite Pieces</span>
            <span className="text-xs text-charcoal-400 font-normal">{savedClothing.length} Pieces</span>
          </h3>

          {savedClothing.length === 0 ? (
            <div className="text-center py-12 bg-cream-50 rounded-3xl border border-sand-200 mb-6">
              <Shirt className="w-8 h-8 text-sand-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-charcoal-800">No staple garments marked.</p>
              <p className="text-[11px] text-charcoal-400 mt-1">
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
          <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-4 flex items-center justify-between">
            <span>Followed Tastemakers</span>
            <span className="text-xs text-charcoal-400 font-normal">{savedCreators.length} Creators</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedCreators.map((creator) => (
              <div
                key={creator.id}
                onClick={() => navigate(`/profile/${creator.username}`)}
                className="flex items-center gap-3 p-3.5 bg-cream-50 rounded-2xl border border-sand-200 cursor-pointer hover:shadow-soft transition-all"
              >
                <Avatar src={creator.avatar} alt={creator.name} size="md" isVerified={creator.isVerified} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-charcoal-900 truncate">{creator.name}</p>
                  <p className="text-[11px] text-charcoal-400 truncate">@{creator.username}</p>
                </div>
                <span className="text-[11px] bg-sand-200 text-charcoal-700 px-3 py-1 rounded-full font-medium">
                  Profile
                </span>
              </div>
            ))}
          </div>
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
              Collection Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Summer in Milan, Studio Workwear, Weekend Casual"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl px-3.5 py-2.5 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Linen silhouettes, warm earth tones, and lightweight layering..."
              value={collectionDesc}
              onChange={(e) => setCollectionDesc(e.target.value)}
              className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-200">
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
    </AppShell>
  );
};

