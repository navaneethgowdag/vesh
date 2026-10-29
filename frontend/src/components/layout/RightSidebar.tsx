import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WeatherCard } from '../ui/WeatherCard';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

export const RightSidebar: React.FC = () => {
  const { posts, isFollowingUser, toggleFollowUser, dailyFit } = useApp();
  const navigate = useNavigate();

  const suggestedCreators = React.useMemo(() => {
    const map = new Map<string, (typeof posts)[0]['user']>();
    for (const p of posts) {
      if (p.user && p.user.id && !map.has(p.user.id)) {
        map.set(p.user.id, p.user);
      }
    }
    return Array.from(map.values()).slice(0, 3);
  }, [posts]);

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
      posts: `${count} ${count === 1 ? 'look' : 'looks'}`,
    }));
  }, [posts]);

  return (
    <aside className="hidden xl:flex flex-col w-80 2xl:w-96 h-screen sticky top-0 p-6 overflow-y-auto space-y-6 select-none border-l border-[#E5DED3] dark:border-[#393832] bg-[#FFFFFF]/60 dark:bg-[#1E1E1B]/60 transition-colors">
      {/* Weather Widget */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#82796F] dark:text-[#B2AA9E] mb-2.5">
          Atmospheric Context
        </h4>
        <WeatherCard />
      </div>

      {/* Daily Fit Highlight Teaser */}
      {dailyFit && (
        <div className="bg-[#FFFFFF] dark:bg-[#22221F] border border-[#E5DED3] dark:border-[#393832] rounded-2xl p-4 shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-[#C3A36B]/15 text-[#C3A36B] dark:text-[#D1B47A]">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#25211E] dark:text-[#F4F0E8]">
                Daily Curation
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#C3A36B] dark:text-[#D1B47A] bg-[#C3A36B]/10 px-2 py-0.5 rounded-full">
              {dailyFit.score}% Match
            </span>
          </div>

          <p className="font-serif text-sm font-semibold text-[#25211E] dark:text-[#F4F0E8] line-clamp-1 mb-1">
            {dailyFit.outfit?.title || 'Calibrated Editorial Fit'}
          </p>
          <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] line-clamp-2 mb-3 font-sans">
            {dailyFit.explanation?.weatherMatch || dailyFit.explanation?.styleMatch || dailyFit.outfit?.description || 'Composed specifically for today’s temperature and occasion profile.'}
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/daily-fit')}
            className="w-full text-xs"
          >
            Inspect Ensemble →
          </Button>
        </div>
      )}

      {/* Suggested Curators */}
      {suggestedCreators.length > 0 && (
        <div className="bg-[#FFFFFF] dark:bg-[#22221F] border border-[#E5DED3] dark:border-[#393832] rounded-2xl p-4 shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#C3A36B] dark:text-[#D1B47A]" />
              <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#82796F] dark:text-[#B2AA9E]">
                Featured Tastemakers
              </h4>
            </div>
            <button
              onClick={() => navigate('/explore')}
              className="text-[11px] text-[#C3A36B] dark:text-[#D1B47A] hover:underline font-medium"
            >
              Explore
            </button>
          </div>

          <div className="space-y-3">
            {suggestedCreators.map((creator) => {
              const following = isFollowingUser(creator.id) || creator.isFollowing;

              return (
                <div key={creator.id} className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => navigate(`/profile/${creator.username}`)}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1 group"
                  >
                    <Avatar src={creator.avatar} alt={creator.name} size="sm" isVerified={creator.isVerified} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#25211E] dark:text-[#F4F0E8] truncate group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
                        {creator.name}
                      </p>
                      <p className="text-[10px] text-[#82796F] dark:text-[#B2AA9E] truncate">@{creator.username}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={following ? 'outline' : 'secondary'}
                    onClick={() => toggleFollowUser(creator.id)}
                    className="text-[11px] min-h-[32px] px-2.5 py-1 flex-shrink-0"
                  >
                    {following ? 'Following' : 'Follow'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trending Editorial Tags */}
      <div className="bg-[#FFFFFF] dark:bg-[#22221F] border border-[#E5DED3] dark:border-[#393832] rounded-2xl p-4 shadow-subtle">
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-[#C3A36B] dark:text-[#D1B47A]" />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#82796F] dark:text-[#B2AA9E]">
            Aesthetic Movements
          </h4>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {trendingTags.map((t) => (
            <button
              key={t.tag}
              onClick={() => navigate('/explore')}
              className="text-xs px-2.5 py-1 rounded-lg bg-[#F7F4EE] dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] text-[#25211E] dark:text-[#F4F0E8] hover:border-[#C3A36B] dark:hover:border-[#D1B47A] transition-colors"
            >
              <span className="font-medium">{t.tag}</span>
              <span className="text-[10px] text-[#82796F] dark:text-[#B2AA9E] ml-1.5 font-normal">
                {t.posts}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
