import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { DailyEditRecommendation } from '../components/recommendation/DailyEditRecommendation';
import { StoriesTray } from '../components/moments/StoriesTray';
import { StoryViewerModal, StoryGroup } from '../components/moments/StoryViewerModal';
import { AddMomentModal } from '../components/feed/AddMomentModal';
import { FollowingPostsFeed } from '../components/feed/FollowingPostsFeed';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { OutfitMoment } from '../types';

const SEEN_MOMENTS_STORAGE_KEY = 'tailorbird_seen_moments';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const {
    wardrobe,
    weather,
    dailyFit,
    activeOccasion,
    loadActiveDailyFit,
    regenerateDailyFit,
    wearDailyFit,
    isGeneratingDailyFit,
    showToast,
    unreadNotifsCount,
  } = useApp();

  // 24-Hour Moments State
  const [followingMoments, setFollowingMoments] = useState<OutfitMoment[]>([]);
  const [myMoments, setMyMoments] = useState<OutfitMoment[]>([]);
  const [isMomentsLoading, setIsMomentsLoading] = useState<boolean>(true);
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number>(0);
  const [isAddMomentOpen, setIsAddMomentOpen] = useState<boolean>(false);

  // Track seen moments in localStorage
  const [seenMomentIds, setSeenMomentIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SEEN_MOMENTS_STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch {
      // quiet
    }
    return new Set<string>();
  });

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  // Load Home Data (Moments & Daily Fit)
  const loadHomeData = useCallback(async () => {
    try {
      setIsMomentsLoading(true);

      // 1. Fetch 24-Hour Moments: Followed accounts feed + Own moments
      const [feedMoments, mine] = await Promise.all([
        api.moments.listFeed(40, 0, true).catch(() => []),
        api.moments.listMine().catch(() => []),
      ]);
      setFollowingMoments(feedMoments);
      setMyMoments(mine);

      // 2. Load active dailyFit if not yet hydrated
      if (!dailyFit && wardrobe.length > 0) {
        await loadActiveDailyFit();
      }
    } catch (err) {
      console.warn('Home data load error:', err);
    } finally {
      setIsMomentsLoading(false);
    }
  }, [dailyFit, wardrobe.length, loadActiveDailyFit]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // Handle Regenerate
  const handleRegenerate = async () => {
    if (isGeneratingDailyFit) return;
    await regenerateDailyFit(activeOccasion);
  };

  // Handle Mark Moment Seen
  const handleMarkMomentSeen = useCallback((moment: OutfitMoment) => {
    setSeenMomentIds((prev) => {
      if (prev.has(moment.id)) return prev;
      const updated = new Set(prev).add(moment.id);
      try {
        localStorage.setItem(SEEN_MOMENTS_STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // quiet
      }
      return updated;
    });
  }, []);

  // Handle Like Moment
  const handleLikeMoment = async (moment: OutfitMoment) => {
    try {
      await api.moments.like(moment.id);
      setFollowingMoments((prev) =>
        prev.map((item) =>
          item.id === moment.id
            ? { ...item, isLiked: true, likesCount: item.likesCount + 1 }
            : item
        )
      );
      setMyMoments((prev) =>
        prev.map((item) =>
          item.id === moment.id
            ? { ...item, isLiked: true, likesCount: item.likesCount + 1 }
            : item
        )
      );
    } catch {
      // quiet
    }
  };

  // Handle Moment Created
  const handleMomentCreated = (newMoment: OutfitMoment) => {
    setMyMoments((prev) => [newMoment, ...prev]);
    showToast('24-Hour Moment published successfully!', 'success');
  };

  // Compile all story groups for StoryViewerModal
  const allStoryGroups = useMemo<StoryGroup[]>(() => {
    const groups: StoryGroup[] = [];

    // Group 0: Your Story (if active moments exist)
    if (myMoments.length > 0 && currentUser) {
      groups.push({
        user: {
          id: currentUser.id,
          name: currentUser.name || 'You',
          username: currentUser.username || 'you',
          avatar: currentUser.avatar,
        },
        moments: myMoments,
        hasUnseen: false,
      });
    }

    // Followed accounts grouped by user ID
    const followedMap = new Map<string, StoryGroup>();
    followingMoments.forEach((m) => {
      const uId = m.user.id;
      if (!followedMap.has(uId)) {
        followedMap.set(uId, {
          user: m.user,
          moments: [],
          hasUnseen: false,
        });
      }
      const grp = followedMap.get(uId)!;
      grp.moments.push(m);
      if (!seenMomentIds.has(m.id)) {
        grp.hasUnseen = true;
      }
    });

    groups.push(...Array.from(followedMap.values()));
    return groups;
  }, [myMoments, followingMoments, currentUser, seenMomentIds]);

  const handleOpenStory = (groupIndex: number) => {
    setActiveGroupIndex(groupIndex);
    setViewerOpen(true);
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={loadHomeData}>
        <div className="max-w-4xl mx-auto space-y-10 sm:space-y-12 select-none px-4 sm:px-6 py-2">
          {/* ----------------------------------------------------------- */}
          {/* EDITORIAL BRANDING & GREETING HEADER */}
          {/* ----------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#EAE3D8] dark:border-[#36322D]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#75624D] dark:text-[#C2AB95]">
                  TAILORBIRD ATELIER
                </span>
                <span className="text-[#B8A99A]">·</span>
                <span className="text-[11px] text-[#A68B72] dark:text-[#B8A99A] font-sans italic">
                  {formattedDate}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-serif text-[#25231F] dark:text-[#F8F6F1] tracking-tight leading-tight">
                <span>{getGreeting()},</span>{' '}
                <span className="italic font-normal text-[#75624D] dark:text-[#C2AB95]">
                  {currentUser?.name?.split(' ')[0] || 'Member'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#A68B72] dark:text-[#B8A99A] mt-1.5 font-sans">
                Your personal wardrobe curation is calibrated for today.
              </p>
            </div>

            {/* Notification Bell */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2.5 rounded-[2px] border border-[#EAE3D8] dark:border-[#36322D] bg-[#FFFFFF] dark:bg-[#211E1B] text-[#75624D] dark:text-[#C2AB95] hover:text-[#25231F] dark:hover:text-[#F8F6F1] transition-colors cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white dark:ring-[#211E1B]" />
                )}
              </button>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* SECTION 1: CLOTHING RECOMMENDATIONS (CENTERPIECE) */}
          {/* ----------------------------------------------------------- */}
          <DailyEditRecommendation
            dailyFit={dailyFit}
            weather={weather}
            activeOccasion={activeOccasion}
            isGenerating={isGeneratingDailyFit}
            wardrobeCount={wardrobe.length}
            onRegenerate={handleRegenerate}
            onWear={wearDailyFit}
            showToast={showToast}
          />

          {/* ----------------------------------------------------------- */}
          {/* SECTION 2: 24-HOUR MOMENTS (HORIZONTAL STORIES RAIL) */}
          {/* ----------------------------------------------------------- */}
          <StoriesTray
            currentUser={currentUser}
            myMoments={myMoments}
            followingMoments={followingMoments}
            seenMomentIds={seenMomentIds}
            onOpenStory={handleOpenStory}
            onOpenAddMoment={() => setIsAddMomentOpen(true)}
            isLoading={isMomentsLoading}
          />

          {/* ----------------------------------------------------------- */}
          {/* SECTION 3: POSTS FROM FOLLOWED USERS (FROM YOUR CIRCLE) */}
          {/* ----------------------------------------------------------- */}
          <FollowingPostsFeed />
        </div>

        {/* 24-Hour Moments Story Viewer Modal */}
        <StoryViewerModal
          isOpen={viewerOpen}
          storyGroups={allStoryGroups}
          initialGroupIndex={activeGroupIndex}
          currentUserId={currentUser?.id}
          onClose={() => setViewerOpen(false)}
          onLike={handleLikeMoment}
          onMarkSeen={handleMarkMomentSeen}
        />

        {/* Add / Upload 24-Hour Moment Modal */}
        <AddMomentModal
          isOpen={isAddMomentOpen}
          onClose={() => setIsAddMomentOpen(false)}
          onSuccess={handleMomentCreated}
        />
      </PullToRefresh>
    </AppShell>
  );
};
