import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Sparkles,
  Grid,
  Bookmark,
  Shirt,
  FolderHeart,
  MapPin,
  Calendar,
  PieChart as PieIcon,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { StyleChip } from '../components/ui/StyleChip';
import { PostCard } from '../components/feed/PostCard';
import { ClothingCard } from '../components/wardrobe/ClothingCard';
import { useApp, useCurrentUser } from '../context/AppContext';

export const Profile: React.FC = () => {
  const { posts, wardrobe, collections } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'Posts' | 'Outfits' | 'Saved' | 'Collections'>('Posts');

  const myPosts = posts.filter((p) => p.user.id === currentUser.id);
  const savedPosts = posts.filter((p) => p.isSaved);

  // Recharts wardrobe distribution data
  const categoryData = [
    { name: 'Tops', value: wardrobe.filter((i) => i.category === 'Tops').length, color: '#A8764B' },
    { name: 'Bottoms', value: wardrobe.filter((i) => i.category === 'Bottoms').length, color: '#3D2516' },
    { name: 'Outerwear', value: wardrobe.filter((i) => i.category === 'Outerwear').length, color: '#8C5E37' },
    { name: 'Shoes', value: wardrobe.filter((i) => i.category === 'Shoes').length, color: '#C69A72' },
    { name: 'Accessories', value: wardrobe.filter((i) => i.category === 'Accessories' || i.category === 'Bags').length, color: '#DCBDA1' },
  ].filter((d) => d.value > 0);

  return (
    <AppShell>
      {/* Profile Header Card */}
      <div className="bg-cream-50 rounded-3xl border border-sand-200/90 p-6 sm:p-8 shadow-soft mb-8">
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
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
                  {currentUser.name}
                </h1>
                <p className="text-xs sm:text-sm text-charcoal-500">@{currentUser.username}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings')}
                  icon={<Settings className="w-4 h-4" />}
                >
                  Edit Profile
                </Button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-charcoal-700 max-w-xl leading-relaxed mb-4">
              {currentUser.bio}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-charcoal-500 mb-6">
              {currentUser.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cognac-600" />
                  {currentUser.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cognac-600" />
                {currentUser.joinedDate}
              </span>
            </div>

            {/* Social Stats Row */}
            <div className="flex items-center justify-center sm:justify-start gap-8 pt-4 border-t border-sand-200/80">
              <div className="text-center sm:text-left">
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {myPosts.length}
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Posts</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {(currentUser.followersCount / 1000).toFixed(1)}K
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Followers</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {currentUser.followingCount}
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Following</span>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {wardrobe.length}
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Wardrobe</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Style Preferences & Wardrobe Analytics Box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        {/* Style Preferences */}
        <div className="md:col-span-7 bg-sand-100/90 rounded-3xl p-5 border border-sand-200/90 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-cognac-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
              Style Preferences & Aesthetic Signature
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {currentUser.preferences.styles.map((style) => (
              <span
                key={style}
                className="bg-cream-50 text-charcoal-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-sand-200 shadow-soft-sm"
              >
                {style}
              </span>
            ))}
            <span className="bg-cream-50 text-charcoal-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-sand-200 shadow-soft-sm">
              Neutral Colors
            </span>
          </div>

          <p className="text-xs text-charcoal-600 leading-relaxed">
            <strong className="text-charcoal-900">Lifestyle:</strong>{' '}
            {currentUser.preferences.lifestyle}
          </p>
          <p className="text-xs text-charcoal-600 leading-relaxed mt-1">
            <strong className="text-charcoal-900">Staple Pieces:</strong>{' '}
            {currentUser.preferences.staplePieces.join(', ')}
          </p>
        </div>

        {/* Recharts Capsule Visualizer */}
        <div className="md:col-span-5 bg-cream-50 rounded-3xl p-5 border border-sand-200/90 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal-700 flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-cognac-700" />
              Capsule Composition
            </span>
            <span className="text-[11px] text-charcoal-500">{wardrobe.length} Pieces</span>
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
                    backgroundColor: '#FAF7F2',
                    borderRadius: '12px',
                    borderColor: '#DFCDB8',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-1 text-[10px] text-charcoal-600">
            {categoryData.map((item) => (
              <span key={item.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center justify-center sm:justify-start gap-8 border-b border-sand-200 mb-6">
        {(['Posts', 'Outfits', 'Saved', 'Collections'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === tab
                ? 'text-charcoal-950 font-bold border-b-2 border-charcoal-900 -mb-px'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'Posts' && (
        <div className="space-y-6">
          {myPosts.length === 0 ? (
            <div className="text-center py-16 bg-cream-50 rounded-3xl border border-sand-200">
              <p className="text-xs font-bold text-charcoal-800">No published posts yet</p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate('/create')}
                className="mt-3"
              >
                Publish Your First Outfit Look
              </Button>
            </div>
          ) : (
            myPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      )}

      {activeTab === 'Outfits' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {wardrobe.slice(0, 6).map((item) => (
            <ClothingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {activeTab === 'Saved' && (
        <div className="space-y-6">
          {savedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {activeTab === 'Collections' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              className="bg-cream-50 rounded-2xl border border-sand-200 overflow-hidden shadow-soft"
            >
              <img src={col.coverImage} alt={col.name} className="w-full aspect-[4/3] object-cover" />
              <div className="p-3">
                <p className="font-serif font-bold text-xs text-charcoal-900 truncate">{col.name}</p>
                <p className="text-[10px] text-charcoal-500">{col.itemCount} items</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
};

