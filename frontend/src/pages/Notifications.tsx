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
        return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne" />;
      case 'daily_fit':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'collection_save':
        return <Bookmark className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne fill-luxury-champagne" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-luxury-textMuted dark:text-luxury-dark-textMuted" />;
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-luxury-champagne/15 text-luxury-champagne dark:text-luxury-dark-champagne rounded-xl border border-luxury-champagne/30">
                <Bell className="w-4 h-4" />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-luxury-text dark:text-luxury-dark-text">
                Activity & Notifications
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
              Stay in sync with likes, comments, following tastemakers, and AI fit alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh notifications"
              className="p-2.5 rounded-full border border-luxury-border dark:border-luxury-dark-border text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text bg-luxury-surface dark:bg-luxury-dark-surface hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle transition-all cursor-pointer shadow-soft-xs"
              aria-label="Refresh activity"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-luxury-champagne' : ''}`} />
            </button>

            {unreadNotifsCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllNotificationsAsRead}
                icon={<CheckCheck className="w-4 h-4 text-luxury-champagne" />}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!hasAnyNotifications && (
          <div className="py-20 px-6 text-center bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border max-w-md mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle border border-luxury-border dark:border-luxury-dark-border flex items-center justify-center text-luxury-champagne mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text">
              All caught up
            </h3>
            <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
              When fellow tastemakers interact with your looks, you will see notifications here.
            </p>
          </div>
        )}

        {/* Notifications grouped */}
        {hasAnyNotifications && (
          <div className="space-y-8">
            {groups.map((grp) => {
              const items = notifications.filter((n) => n.group === grp);
              if (items.length === 0) return null;

              return (
                <div key={grp}>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-3 px-1">
                    {grp}
                  </h2>

                  <div className="space-y-2.5">
                    {items.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                          notif.isRead
                            ? 'bg-luxury-surface/70 dark:bg-luxury-dark-surface/70 border-luxury-border dark:border-luxury-dark-border hover:bg-luxury-surface dark:hover:bg-luxury-dark-surface'
                            : 'bg-luxury-surface dark:bg-luxury-dark-surface border-luxury-champagne/40 dark:border-luxury-dark-champagne/40 hover:border-luxury-champagne shadow-soft-xs'
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
                              <div className="w-10 h-10 rounded-full bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle flex items-center justify-center text-luxury-champagne">
                                {getIcon(notif.type)}
                              </div>
                            )}
                            <span className="absolute -bottom-1 -right-1 bg-luxury-surface dark:bg-luxury-dark-surface rounded-full p-1 shadow-sm border border-luxury-border dark:border-luxury-dark-border">
                              {getIcon(notif.type)}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text leading-snug">
                              {notif.title}
                            </p>
                            <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted mt-0.5 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                            <span className="text-[10px] text-luxury-textMuted/70 dark:text-luxury-dark-textMuted/70 mt-1 block">
                              {notif.timeAgo}
                            </span>
                          </div>
                        </div>

                        {/* Target Image preview */}
                        {notif.targetImage && (
                          <img
                            src={notif.targetImage}
                            alt="Target preview"
                            className="w-12 h-12 rounded-xl object-cover border border-luxury-border dark:border-luxury-dark-border ml-3 flex-shrink-0 shadow-sm"
                          />
                        )}

                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-luxury-champagne dark:bg-luxury-dark-champagne ml-3 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
