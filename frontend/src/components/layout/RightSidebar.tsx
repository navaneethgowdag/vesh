import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users } from 'lucide-react';
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

  return (
    <aside className="hidden xl:flex flex-col w-80 2xl:w-96 h-screen sticky top-0 p-6 overflow-y-auto space-y-6 select-none border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] transition-colors">
      {/* Weather Widget */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5">
          Atmospheric Context
        </h4>
        <WeatherCard />
      </div>

      {/* Daily Fit Highlight Teaser */}
      {dailyFit && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Daily Curation
              </span>
            </div>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">
              {dailyFit.score}% Match
            </span>
          </div>

          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 mb-1">
            {dailyFit.outfit?.title || 'Calibrated Editorial Fit'}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
            {dailyFit.explanation?.weatherMatch || dailyFit.explanation?.styleMatch || dailyFit.outfit?.description || 'Composed specifically for today’s temperature and occasion profile.'}
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/daily-fit')}
            className="w-full text-xs min-h-[38px]"
          >
            Inspect Ensemble →
          </Button>
        </div>
      )}

      {/* Suggested Curators */}
      {suggestedCreators.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Featured Tastemakers
              </h4>
            </div>
            <button
              onClick={() => navigate('/explore')}
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline font-medium"
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
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                        {creator.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">@{creator.username}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={following ? 'outline' : 'secondary'}
                    onClick={() => toggleFollowUser(creator.id)}
                    className="text-xs min-h-[34px] px-3 py-1 flex-shrink-0"
                  >
                    {following ? 'Following' : 'Follow'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
