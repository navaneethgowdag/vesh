import React, { useMemo } from 'react';
import { Plus, Clock, Camera } from 'lucide-react';
import { OutfitMoment, User } from '../../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { StoryGroup } from './StoryViewerModal';

interface StoriesTrayProps {
  currentUser: User | null;
  myMoments: OutfitMoment[];
  followingMoments: OutfitMoment[];
  seenMomentIds: Set<string>;
  onOpenStory: (groupIndex: number) => void;
  onOpenAddMoment: () => void;
  isLoading?: boolean;
}

export const StoriesTray: React.FC<StoriesTrayProps> = ({
  currentUser,
  myMoments,
  followingMoments,
  seenMomentIds,
  onOpenStory,
  onOpenAddMoment,
  isLoading = false,
}) => {
  // Group followed moments by user ID
  const followingGroups = useMemo<StoryGroup[]>(() => {
    const map = new Map<string, StoryGroup>();

    followingMoments.forEach((m) => {
      const uId = m.user.id;
      if (!map.has(uId)) {
        map.set(uId, {
          user: m.user,
          moments: [],
          hasUnseen: false,
        });
      }
      const grp = map.get(uId)!;
      grp.moments.push(m);
      if (!seenMomentIds.has(m.id)) {
        grp.hasUnseen = true;
      }
    });

    return Array.from(map.values());
  }, [followingMoments, seenMomentIds]);

  const hasMyMoments = myMoments.length > 0;

  return (
    <div className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#211E1B] border border-[#EAE3D8] dark:border-[#36322D] p-5 shadow-xs space-y-4 transition-colors">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#75624D] dark:text-[#C2AB95]" />
          <h3 className="text-xs font-sans font-bold uppercase tracking-[0.16em] text-[#25231F] dark:text-[#F8F6F1]">
            24-Hour Moments
          </h3>
          <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-[2px] bg-[#F8F6F1] dark:bg-[#181614] text-[#75624D] dark:text-[#C2AB95] border border-[#EAE3D8] dark:border-[#36322D] uppercase tracking-[0.1em]">
            Ephemeral
          </span>
        </div>

        <button
          onClick={onOpenAddMoment}
          className="text-xs text-[#75624D] dark:text-[#C2AB95] font-sans font-semibold hover:text-[#25231F] dark:hover:text-[#F8F6F1] flex items-center gap-1.5 cursor-pointer uppercase tracking-[0.12em] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Share Moment</span>
        </button>
      </div>

      {/* Horizontal Story Ring Rail */}
      <div className="flex items-center gap-4 overflow-x-auto pb-1 pt-1 no-scrollbar scroll-smooth">
        {/* GROUP A: YOUR STORY */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 select-none group">
          <div className="relative">
            {/* Story Ring Avatar */}
            <button
              onClick={() => {
                if (hasMyMoments) {
                  onOpenStory(0);
                } else {
                  onOpenAddMoment();
                }
              }}
              className={`w-16 h-16 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105 cursor-pointer focus:outline-none ${
                hasMyMoments
                  ? 'bg-gradient-to-tr from-[#75624D] via-[#A68B72] to-[#526052]'
                  : 'border-2 border-dashed border-[#B8A99A] dark:border-[#4A443E]'
              }`}
              title={hasMyMoments ? 'View Your Story' : 'Share a Moment'}
            >
              <div className="w-full h-full rounded-full bg-white dark:bg-[#211E1B] p-[2px] overflow-hidden flex items-center justify-center">
                {hasMyMoments ? (
                  <img
                    src={resolveImageUrl(myMoments[0].imageUrl) || currentUser?.avatar || FALLBACK_POST_IMAGE}
                    alt="Your Story"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <Camera className="w-5 h-5 text-[#A68B72]" />
                )}
              </div>
            </button>

            {/* Quick Add Button or Badge */}
            {hasMyMoments ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAddMoment();
                }}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#75624D] text-white flex items-center justify-center ring-2 ring-white dark:ring-[#211E1B] shadow-xs hover:bg-[#526052] transition-colors cursor-pointer"
                title="Add Another Moment"
              >
                <Plus className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={onOpenAddMoment}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#25231F] dark:bg-[#F8F6F1] text-white dark:text-[#25231F] flex items-center justify-center ring-2 ring-white dark:ring-[#211E1B] shadow-xs cursor-pointer"
                title="Post a Look"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          <span className="text-[11px] font-sans font-medium text-[#75624D] dark:text-[#C2AB95] max-w-[70px] truncate text-center">
            Your Story
          </span>
        </div>

        {/* Vertical Divider between Your Story and Following */}
        {followingGroups.length > 0 && (
          <div className="h-10 w-[1px] bg-[#EAE3D8] dark:bg-[#36322D] shrink-0 self-center" />
        )}

        {/* GROUP B: FOLLOWING ACCOUNTS */}
        {isLoading ? (
          // Loading Skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-[#EAE3D8]/70 dark:bg-[#36322D]/60" />
              <div className="w-12 h-2.5 rounded-[2px] bg-[#EAE3D8]/70 dark:bg-[#36322D]/60" />
            </div>
          ))
        ) : followingGroups.length > 0 ? (
          followingGroups.map((grp, idx) => {
            const firstMoment = grp.moments[0];
            const hoursLeft = Math.max(1, Math.round((firstMoment.timeRemainingSeconds || 3600) / 3600));
            // Actual groupIndex in StoryViewerModal: account 0 is Your Story (if hasMyMoments), followed by followingGroups
            const groupModalIndex = hasMyMoments ? idx + 1 : idx;

            return (
              <div
                key={grp.user.id}
                onClick={() => onOpenStory(groupModalIndex)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer select-none group"
              >
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105 ${
                      grp.hasUnseen
                        ? 'bg-gradient-to-tr from-[#75624D] via-[#A68B72] to-[#526052]'
                        : 'border border-[#B8A99A] dark:border-[#4A443E]'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-white dark:bg-[#211E1B] p-[2px] overflow-hidden">
                      <img
                        src={resolveImageUrl(grp.user.avatar) || resolveImageUrl(firstMoment.imageUrl) || FALLBACK_POST_IMAGE}
                        alt={grp.user.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                  </div>

                  {/* Hours Left Badge */}
                  <div className="absolute -bottom-0.5 -right-0.5 px-1.5 py-0.2 rounded-full bg-[#25231F]/90 text-[9px] font-mono font-bold text-white shadow-xs ring-1 ring-white dark:ring-[#211E1B]">
                    {hoursLeft}h
                  </div>
                </div>

                <span className="text-[11px] font-sans font-medium text-[#25231F] dark:text-[#F8F6F1] max-w-[70px] truncate text-center">
                  {grp.user.name.split(' ')[0]}
                </span>
              </div>
            );
          })
        ) : (
          // Empty State: Followed users have no active moments
          <div className="flex items-center gap-2.5 py-2 px-3 text-xs text-[#A68B72] dark:text-[#B8A99A] font-sans italic">
            <span>No new Moments from people you follow.</span>
          </div>
        )}
      </div>
    </div>
  );
};
