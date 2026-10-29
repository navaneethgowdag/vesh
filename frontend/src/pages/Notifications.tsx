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
        return <UserPlus className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />;
      case 'daily_fit':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'collection_save':
        return <Bookmark className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 fill-zinc-900 dark:fill-zinc-100" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
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
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md border border-zinc-200 dark:border-zinc-700">
                <Bell className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Activity & Notifications
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Stay in sync with likes, comments, following tastemakers, and AI fit alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh notifications"
              className="w-11 h-11 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
              aria-label="Refresh activity"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zinc-900 dark:text-zinc-100' : ''}`} />
            </button>

            {unreadNotifsCount > 0 && (
              <Button
                variant="outline"
                size="md"
                onClick={markAllNotificationsAsRead}
                icon={<CheckCheck className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!hasAnyNotifications && (
          <div className="py-20 px-6 text-center bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto my-8">
            <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              All caught up
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
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
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5 px-1">
                    {grp}
                  </h2>

                  <div className="space-y-2">
                    {items.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-md border transition-all cursor-pointer ${
                          notif.isRead
                            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                            : 'bg-zinc-50 dark:bg-zinc-800/70 border-zinc-300 dark:border-zinc-700 shadow-sm'
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
                              <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                                {getIcon(notif.type)}
                              </div>
                            )}
                            <span className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-md p-1 shadow-sm border border-zinc-200 dark:border-zinc-700">
                              {getIcon(notif.type)}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                              {notif.title}
                            </p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 block">
                              {notif.timeAgo}
                            </span>
                          </div>
                        </div>

                        {/* Target Image preview */}
                        {notif.targetImage && (
                          <img
                            src={notif.targetImage}
                            alt="Target preview"
                            className="w-12 h-12 rounded-md object-cover border border-zinc-200 dark:border-zinc-800 ml-3 flex-shrink-0 shadow-sm"
                          />
                        )}

                        {!notif.isRead && (
                          <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100 ml-3 flex-shrink-0" />
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
