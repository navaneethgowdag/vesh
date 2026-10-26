import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Calendar,
  Grid,
  Share2,
  Loader2,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PostCard } from '../components/feed/PostCard';
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

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setIsLoading(true);

    api.users
      .getByUsername(username)
      .then((u) => {
        if (!cancelled) setCreator(u);
      })
      .catch(() => {
        if (!cancelled) setCreator(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="text-center py-24 bg-cream-50 rounded-3xl border border-sand-200">
          <Loader2 className="w-8 h-8 text-cognac-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-charcoal-500">Loading curator profile...</p>
        </div>
      </AppShell>
    );
  }

  if (!creator) {
    return (
      <AppShell>
        <div className="text-center py-20 bg-cream-50 rounded-3xl border border-sand-200">
          <p className="font-serif font-bold text-lg text-charcoal-900">Creator not found</p>
          <p className="text-xs text-charcoal-500 mt-1">This user may not have an active profile on StyleSphere.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/explore')}
            className="mt-4"
          >
            Explore Tastemakers
          </Button>
        </div>
      </AppShell>
    );
  }

  const isFollowing = isFollowingUser(creator.id);
  const creatorPosts = posts.filter(
    (p) => p.user.id === creator.id || p.user.username.toLowerCase() === creator.username.toLowerCase()
  );

  return (
    <AppShell>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-semibold text-charcoal-600 hover:text-charcoal-950 transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back</span>
      </button>

      {/* Header Profile Box */}
      <div className="bg-cream-50 rounded-3xl border border-sand-200/90 p-6 sm:p-8 shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          <Avatar
            src={creator.avatar}
            alt={creator.name}
            size="2xl"
            isVerified={creator.isVerified}
          />

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
                  {creator.name}
                </h1>
                <p className="text-xs sm:text-sm text-charcoal-500">@{creator.username}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <Button
                  variant={isFollowing ? 'outline' : 'primary'}
                  size="md"
                  onClick={async () => {
                    await toggleFollowUser(creator.id);
                  }}
                  className="px-6"
                >
                  {isFollowing ? 'Following' : '+ Follow'}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('Creator profile link copied!', 'info');
                  }}
                  icon={<Share2 className="w-4 h-4" />}
                >
                  Share
                </Button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-charcoal-700 max-w-xl leading-relaxed mb-4">
              {creator.bio || 'Curating intentional looks and versatile wardrobe capsules on StyleSphere.'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-charcoal-500 mb-6">
              {creator.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cognac-600" />
                  {creator.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cognac-600" />
                Joined {creator.joinedDate}
              </span>
            </div>

            {/* Social Stats */}
            <div className="flex items-center justify-center sm:justify-start gap-8 pt-4 border-t border-sand-200/80">
              <div>
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {creator.postsCount ?? creatorPosts.length}
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Posts</span>
              </div>
              <div>
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {creator.followersCount}
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Followers</span>
              </div>
              <div>
                <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 block">
                  {creator.followingCount}
                </span>
                <span className="text-[11px] text-charcoal-500 uppercase font-semibold">Following</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outfits Stream */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-cognac-600" />
            <h3 className="font-serif text-lg font-bold text-charcoal-900">
              Shared Outfits & Rotations
            </h3>
          </div>
          <span className="text-xs text-charcoal-500">{creatorPosts.length} Looks</span>
        </div>

        {creatorPosts.length === 0 ? (
          <div className="text-center py-16 bg-cream-50 rounded-3xl border border-sand-200">
            <p className="text-sm font-bold text-charcoal-800">No outfit looks shared yet</p>
            <p className="text-xs text-charcoal-500 mt-1">
              Check back soon for new styling inspirations from {creator.name}.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {creatorPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
