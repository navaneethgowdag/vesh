import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Sparkles,
  Bookmark,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { Notification } from '../types';

export const Notifications: React.FC = () => {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    unreadNotifsCount,
    refreshData,
  } = useApp();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const groups = ['Today', 'Yesterday', 'Earlier'] as const;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 text-[#743C49] fill-[#743C49]" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 text-[#29202B] dark:text-[#F3EEE8]" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />;
      case 'daily_fit':
        return <Sparkles className="w-3.5 h-3.5 text-[#B49B82]" />;
      case 'collection_save':
        return <Bookmark className="w-3.5 h-3.5 text-[#29202B] dark:text-[#F3EEE8] fill-current" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-[#777078]" />;
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    markNotificationAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const hasAnyNotifications = notifications.length > 0;

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 select-none">
          {/* Editorial Header */}
          <EditorialPageHeader
            eyebrow="COMMUNITY & SYSTEM ACTIVITY"
            title="Notifications"
            italicTitle="Log."
            description="Stay in sync with likes, comments, following tastemakers, and AI fit alerts."
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="Refresh notifications"
                  className="w-9 h-9 flex items-center justify-center rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] bg-white dark:bg-[#1F1922] hover:border-[#743C49] transition-colors cursor-pointer"
                  aria-label="Refresh activity"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#743C49]' : ''}`} />
                </button>

                {unreadNotifsCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllNotificationsAsRead}
                    icon={<CheckCheck className="w-3.5 h-3.5" />}
                    className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em] border-[#DCD4CC] dark:border-[#392F3E]"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            }
          />

          {/* Empty state */}
          {!hasAnyNotifications && (
            <div className="py-20 px-6 text-center bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] max-w-md mx-auto my-8">
              <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center text-[#743C49] mx-auto mb-3">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                All caught up
              </h3>
              <p className="text-xs text-[#777078] dark:text-[#A89E9B] mt-1">
                When fellow tastemakers interact with your looks, you will see notifications here.
              </p>
            </div>
          )}

          {/* Notifications grouped */}
          {hasAnyNotifications && (
            <div className="space-y-6">
              {groups.map((grp) => {
                const items = notifications.filter((n) => n.group === grp);
                if (items.length === 0) return null;

                return (
                  <div key={grp}>
                    <h2 className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#777078] dark:text-[#D5A6A0] mb-2.5 px-1 font-semibold">
                      {grp}
                    </h2>

                    <div className="space-y-2">
                      {items.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`flex items-center justify-between p-3.5 sm:p-4 rounded-[3px] border transition-colors cursor-pointer ${
                            notif.isRead
                              ? 'bg-white dark:bg-[#1F1922] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]'
                              : 'bg-[#FAF6F0] dark:bg-[#241D27] border-[#743C49]/40'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Avatar with type badge */}
                            <div className="relative flex-shrink-0">
                              {notif.actionUser ? (
                                <Avatar
                                  src={notif.actionUser.avatar}
                                  alt={notif.actionUser.name}
                                  size="md"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center text-[#29202B] dark:text-[#F3EEE8]">
                                  {getIcon(notif.type)}
                                </div>
                              )}
                              <span className="absolute -bottom-1 -right-1 bg-white dark:bg-[#1F1922] rounded-[2px] p-1 border border-[#DCD4CC] dark:border-[#392F3E]">
                                {getIcon(notif.type)}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-serif text-[#29202B] dark:text-[#F3EEE8] leading-snug">
                                {notif.title}
                              </p>
                              <p className="text-xs text-[#777078] dark:text-[#A89E9B] mt-0.5 line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>
                              <span className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-1 block">
                                {notif.timeAgo}
                              </span>
                            </div>
                          </div>

                          {/* Target Image preview */}
                          {notif.targetImage && (
                            <img
                              src={notif.targetImage}
                              alt="Target preview"
                              className="w-12 h-12 rounded-[2px] object-cover border border-[#DCD4CC] dark:border-[#392F3E] ml-3 flex-shrink-0"
                            />
                          )}

                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#743C49] ml-3 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PullToRefresh>
    </AppShell>
  );
};
