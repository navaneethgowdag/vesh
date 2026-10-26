import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WeatherCard } from '../ui/WeatherCard';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

export const RightSidebar: React.FC = () => {
  const { posts, isFollowingUser, toggleFollowUser, dailyFit } = useApp();

  const suggestedCreators = React.useMemo(() => {
    const map = new Map<string, (typeof posts)[0]['user']>();
    for (const p of posts) {
      if (p.user && p.user.id && !map.has(p.user.id)) {
        map.set(p.user.id, p.user);
      }
    }
    return Array.from(map.values()).slice(0, 3);
  }, [posts]);
  const navigate = useNavigate();

  const trendingTags = React.useMemo(() => {
    const tagCountMap: Record<string, number> = {};
    for (const p of posts) {
      if (Array.isArray(p.tags)) {
        for (const raw of p.tags) {
          const t = raw.startsWith('#') ? raw : `#${raw}`;
          tagCountMap[t] = (tagCountMap[t] || 0) + 1;
        }
      }
    }
    const entries = Object.entries(tagCountMap).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return [
        { tag: '#QuietLuxury', posts: 'Explore' },
        { tag: '#CapsuleWardrobe', posts: 'Explore' },
        { tag: '#MinimalStyle', posts: 'Explore' },
      ];
    }
    return entries.slice(0, 6).map(([tag, count]) => ({
      tag,
      posts: `${count} ${count === 1 ? 'post' : 'posts'}`,
    }));
  }, [posts]);

  return (
    <aside className="hidden xl:flex flex-col w-80 2xl:w-96 h-screen sticky top-0 p-6 overflow-y-auto space-y-6 select-none border-l border-sand-200/80">
      {/* Weather Widget */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-3">
          Local Weather & Climate
        </h4>
        <WeatherCard />
      </div>

      {/* Daily Fit Highlight Teaser */}
      {dailyFit && (
        <div className="bg-sand-100/90 border border-sand-200/90 rounded-3xl p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-cognac-100 text-cognac-700 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal-800">
                Today's Daily Fit
              </span>
            </div>
            <span className="text-xs font-bold text-cognac-700 bg-cognac-50 px-2 py-0.5 rounded-full border border-cognac-200/60">
              {dailyFit.score}% Match
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-3 group cursor-pointer" onClick={() => navigate('/daily-fit')}>
            <img
              src={dailyFit.outfit.image}
              alt={dailyFit.outfit.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/80 via-transparent to-transparent flex items-end p-3.5">
              <div>
                <p className="text-white text-xs font-serif font-semibold">{dailyFit.outfit.title}</p>
                <p className="text-cream-200 text-[11px]">{dailyFit.outfit.pieces.length} items styled</p>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/daily-fit')}
            className="w-full text-xs"
          >
            Open Stylist Canvas
          </Button>
        </div>
      )}

      {/* Suggested Creators */}
      <div className="bg-cream-50 rounded-3xl p-5 border border-sand-200/80 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cognac-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-900">
              Suggested Creators
            </h4>
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="text-[11px] text-cognac-700 hover:underline font-medium"
          >
            See all
          </button>
        </div>

        <div className="space-y-3.5">
          {suggestedCreators.length === 0 ? (
            <p className="text-xs text-charcoal-400 italic">No creators yet. Explore the community!</p>
          ) : (
            suggestedCreators.map((creator) => {
              const following = isFollowingUser(creator.id) || creator.isFollowing;

              return (
                <div key={creator.id} className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => navigate(`/profile/${creator.username}`)}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
                  >
                    <Avatar src={creator.avatar} alt={creator.name} size="sm" isVerified={creator.isVerified} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-charcoal-900 truncate group-hover:text-cognac-700">
                        {creator.name}
                      </p>
                      <p className="text-[11px] text-charcoal-400 truncate">@{creator.username}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={following ? 'outline' : 'secondary'}
                    onClick={() => toggleFollowUser(creator.id)}
                    className="text-xs py-1 px-3 h-7 rounded-full flex-shrink-0"
                  >
                    {following ? 'Following' : 'Follow'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Trending Style Aesthetics */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-cognac-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-600">
            Trending Aesthetics
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingTags.map((item) => (
            <button
              key={item.tag}
              onClick={() => navigate('/explore')}
              className="text-xs bg-sand-100 hover:bg-sand-200 text-charcoal-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              <span className="font-medium">{item.tag}</span>
              <span className="text-[10px] text-charcoal-400">{item.posts}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Links */}
      <div className="text-[11px] text-charcoal-400 px-2 space-y-1">
        <p>© 2026 StyleSphere Inc. AI Fashion Social Network.</p>
        <p>Terms · Privacy · Capsule Index · Sustainable Wardrobe</p>
      </div>
    </aside>
  );
};

