import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Sparkles,
  Bookmark,
  CheckCheck,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { Notification } from '../types';

export const Notifications: React.FC = () => {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    unreadNotifsCount,
  } = useApp();
  const navigate = useNavigate();

  const groups = ['Today', 'Yesterday', 'Earlier'] as const;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 text-sky-600 fill-sky-600" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-cognac-600" />;
      case 'daily_fit':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'collection_save':
        return <Bookmark className="w-3.5 h-3.5 text-cognac-700 fill-cognac-700" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-charcoal-600" />;
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    markNotificationAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-charcoal-900 text-cream-50 rounded-xl shadow-soft">
              <Bell className="w-4 h-4" />
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
              Activity & Notifications
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Stay in sync with likes, comments, following tastemakers, and AI fit alerts.
          </p>
        </div>

        {unreadNotifsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllNotificationsAsRead}
            icon={<CheckCheck className="w-4 h-4 text-cognac-700" />}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications grouped */}
      <div className="space-y-8">
        {groups.map((grp) => {
          const items = notifications.filter((n) => n.group === grp);
          if (items.length === 0) return null;

          return (
            <div key={grp}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-400 mb-3 px-1">
                {grp}
              </h2>

              <div className="space-y-2.5">
                {items.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      notif.isRead
                        ? 'bg-cream-50/70 border-sand-200/80 hover:bg-cream-50'
                        : 'bg-sand-100 border-sand-300/80 hover:bg-sand-200/70 shadow-soft-sm'
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
                          <div className="w-10 h-10 rounded-full bg-sand-200 flex items-center justify-center text-cognac-700">
                            {getIcon(notif.type)}
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-cream-50 rounded-full p-1 shadow-sm border border-sand-200">
                          {getIcon(notif.type)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-charcoal-900 leading-snug">
                          {notif.title}
                        </p>
                        <p className="text-xs text-charcoal-600 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-charcoal-400 mt-1 block">
                          {notif.timeAgo}
                        </span>
                      </div>
                    </div>

                    {/* Target Image preview */}
                    {notif.targetImage && (
                      <img
                        src={notif.targetImage}
                        alt="Target preview"
                        className="w-12 h-12 rounded-xl object-cover border border-sand-200 ml-3 flex-shrink-0 shadow-sm"
                      />
                    )}

                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-cognac-600 ml-3 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
};

