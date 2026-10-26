import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  ClothingItem,
  Collection,
  Notification,
  Occasion,
  Post,
  Recommendation,
  User,
  UserSettings,
  Weather,
} from '../types';
import { api, ApiError } from '../services/api';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'heart' | 'save';
}

interface AppContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  authError: string | null;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (data: { name: string; username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUser: (u: User | null) => void;
  wardrobe: ClothingItem[];
  posts: Post[];
  collections: Collection[];
  notifications: Notification[];
  unreadNotifsCount: number;
  dailyFit: Recommendation | null;
  dailyFitHistory: Recommendation[];
  dailyFitError: string | null;
  weather: Weather;
  isWeatherLoading: boolean;
  weatherError: string | null;
  isLiveLocation: boolean;
  liveCoordinates: { latitude: number; longitude: number } | null;
  toggleLiveLocation: (enable?: boolean) => Promise<boolean>;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedOccasion: Occasion;
  setSelectedOccasion: (occ: Occasion) => void;
  userSettings: UserSettings;
  updateUserSettings: (s: UserSettings) => Promise<void>;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'info' | 'heart' | 'save') => void;
  dismissToast: (id: string) => void;

  // Actions — every mutation below persists through FastAPI into Neon.
  addClothingItem: (item: Omit<ClothingItem, 'id' | 'createdAt' | 'timesWorn'>) => Promise<ClothingItem>;
  updateClothingItem: (item: ClothingItem) => Promise<void>;
  deleteClothingItem: (id: string) => Promise<void>;
  toggleLikePost: (postId: string) => Promise<void>;
  toggleSavePost: (postId: string) => Promise<void>;
  addCommentToPost: (postId: string, text: string) => Promise<void>;
  publishPost: (postData: {
    image: string;
    caption: string;
    tags: string[];
    occasion: Occasion;
    location?: string;
    taggedItemIds?: string[];
  }) => Promise<Post>;
  deletePost: (postId: string) => Promise<void>;
  updateProfile: (data: {
    name?: string;
    bio?: string;
    avatar?: string;
    location?: string;
  }) => Promise<void>;
  toggleFollowUser: (userId: string) => Promise<boolean>;
  isFollowingUser: (userId: string) => boolean;
  wearDailyFit: () => Promise<void>;
  cycleDailyFit: () => void;
  createCollection: (name: string, description?: string, coverImage?: string) => Promise<Collection>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  allCreators: User[];
  refreshData: () => Promise<void>;
}

const INITIAL_WEATHER: Weather = {
  city: 'New York',
  country: 'US',
  temp: 20,
  feelsLike: 20,
  condition: 'Partly Cloudy',
  icon: 'cloud-sun',
  humidity: 50,
  windSpeed: 10,
  uvIndex: 5,
  highTemp: 22,
  lowTemp: 18,
  summary: 'Live climate tracking powered by Open-Meteo.',
};

const DEFAULT_SETTINGS: UserSettings = {
  account: { name: '', username: '', email: '', bio: '', location: '' },
  preferences: {
    styles: ['Minimal'],
    preferredColors: ['Black'],
    clothingSizes: { tops: '', bottoms: '', shoes: '' },
    favoriteCategories: [],
  },
  notifications: { likes: true, comments: true, followers: true, dailyRecommendations: true, emailDigest: false },
  appearance: { theme: 'light' },
  privacy: { isPrivateAccount: false, showActivity: true, allowDirectMessages: true },
};

// Rendered only while the session is still being restored, so the shell never
// dereferences a null user.
const PLACEHOLDER_USER: User = {
  id: '',
  name: 'StyleSphere',
  username: 'stylesphere',
  email: '',
  avatar: '',
  bio: '',
  location: '',
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
  wardrobeCount: 0,
  isVerified: false,
  joinedDate: '',
  preferences: {
    styles: [],
    staplePieces: [],
    lifestyle: '',
    favoriteColors: [],
    climatePreference: 'Moderate',
    fitPreference: 'Classic / Regular',
  },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dailyFitHistory, setDailyFitHistory] = useState<Recommendation[]>([]);
  const [dailyFitError, setDailyFitError] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [selectedCity, setSelectedCity] = useState<string>('New York');
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion>('Casual Daily');
  const [weather, setWeather] = useState<Weather>({ ...INITIAL_WEATHER });
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isLiveLocation, setIsLiveLocation] = useState<boolean>(() => {
    return localStorage.getItem('stylesphere_live_location') === 'true';
  });
  const [liveCoordinates, setLiveCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dailyFitVariation, setDailyFitVariation] = useState<number>(0);
  const [dailyFit, setDailyFit] = useState<Recommendation | null>(null);
  // Theme is UI-only state; it never stores application/user data.
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast dispatch
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'heart' | 'save' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleLiveLocation = useCallback(async (enable?: boolean): Promise<boolean> => {
    const shouldEnable = enable !== undefined ? enable : !isLiveLocation;
    if (!shouldEnable) {
      setIsLiveLocation(false);
      setLiveCoordinates(null);
      localStorage.setItem('stylesphere_live_location', 'false');
      showToast('Live GPS disabled. Using manual city selection.', 'info');
      return false;
    }

    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'info');
      return false;
    }

    setIsWeatherLoading(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLiveCoordinates(coords);
          setIsLiveLocation(true);
          localStorage.setItem('stylesphere_live_location', 'true');
          try {
            const w = await api.weather.getCurrent(undefined, coords.latitude, coords.longitude);
            setWeather(w);
            if (w.city) {
              setSelectedCity(w.city);
            }
            setWeatherError(null);
            showToast(`Live GPS active: ${w.city} (${w.temp}°C)`, 'success');
            resolve(true);
          } catch (err) {
            setWeatherError(err instanceof Error ? err.message : 'Could not fetch live GPS weather');
            showToast('Failed to fetch live GPS weather', 'info');
            resolve(false);
          } finally {
            setIsWeatherLoading(false);
          }
        },
        (error) => {
          setIsLiveLocation(false);
          setLiveCoordinates(null);
          localStorage.setItem('stylesphere_live_location', 'false');
          setIsWeatherLoading(false);
          let message = 'Location permission denied. Using manual city selection.';
          if (error.code === error.TIMEOUT) {
            message = 'Location request timed out. Using manual city selection.';
          }
          showToast(message, 'info');
          resolve(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }, [isLiveLocation, showToast]);

  const isAuthenticated = currentUser !== null;

  const syncSettingsFromUser = useCallback((user: User) => {
    setUserSettings((prev) => ({
      ...prev,
      account: {
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        location: user.location || '',
      },
      preferences: {
        ...prev.preferences,
        styles: user.preferences.styles,
        preferredColors: user.preferences.favoriteColors as UserSettings['preferences']['preferredColors'],
      },
    }));
  }, []);

  // Public setter so pages (Signup, Onboarding) can push a freshly loaded user
  // into shared state, keeping the settings form in sync.
  const setCurrentUser = useCallback(
    (user: User | null) => {
      setCurrentUserState(user);
      if (user) {
        syncSettingsFromUser(user);
      }
    },
    [syncSettingsFromUser]
  );

  // Fetch all persistent state from the backend (Neon via FastAPI).
  const refreshData = useCallback(async () => {
    try {
      const user = await api.auth.getMe();
      setCurrentUserState(user);
      syncSettingsFromUser(user);
      setAuthError(null);

      const [items, feedPosts, cols, notifs] = await Promise.all([
        api.wardrobe.list().catch(() => []),
        api.posts.listFeed().catch(() => []),
        api.saved.listCollections().catch(() => []),
        api.notifications.list().catch(() => []),
      ]);
      setWardrobe(items);
      setPosts(feedPosts);
      setCollections(cols);
      setNotifications(notifs);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCurrentUserState(null);
        setWardrobe([]);
        setPosts([]);
        setCollections([]);
        setNotifications([]);
        setDailyFit(null);
      } else {
        showToast('Could not reach the StyleSphere backend. Check that FastAPI is running.', 'info');
      }
    } finally {
      setIsBootstrapping(false);
    }
  }, [showToast, syncSettingsFromUser]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Initial location bootstrap if user previously enabled live location
  useEffect(() => {
    if (isLiveLocation && !liveCoordinates && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveCoordinates({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          setIsLiveLocation(false);
          localStorage.setItem('stylesphere_live_location', 'false');
        },
        { timeout: 6000 }
      );
    }
  }, [isLiveLocation, liveCoordinates]);

  // Real live weather fetching via Open-Meteo
  useEffect(() => {
    let cancelled = false;
    setIsWeatherLoading(true);
    setWeatherError(null);

    const fetchWeather = async () => {
      try {
        if (isLiveLocation && liveCoordinates) {
          const w = await api.weather.getCurrent(undefined, liveCoordinates.latitude, liveCoordinates.longitude);
          if (!cancelled) {
            setWeather(w);
            if (w.city && w.city !== selectedCity) {
              setSelectedCity(w.city);
            }
          }
        } else {
          const w = await api.weather.getCurrent(selectedCity);
          if (!cancelled) setWeather(w);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Live weather temporarily unavailable';
          setWeatherError(msg);
        }
      } finally {
        if (!cancelled) setIsWeatherLoading(false);
      }
    };

    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [selectedCity, isLiveLocation, liveCoordinates]);

  // Daily Fit is generated server-side from Neon data and real Open-Meteo weather
  useEffect(() => {
    if (!isAuthenticated || wardrobe.length === 0) {
      setDailyFit(null);
      return;
    }
    let cancelled = false;
    setDailyFitError(null);
    const lat = isLiveLocation && liveCoordinates ? liveCoordinates.latitude : undefined;
    const lon = isLiveLocation && liveCoordinates ? liveCoordinates.longitude : undefined;

    api.recommendations
      .getDailyFit(selectedCity, selectedOccasion, dailyFitVariation, lat, lon)
      .then((rec) => {
        if (!cancelled) setDailyFit(rec);
      })
      .catch((err) => {
        if (!cancelled) {
          setDailyFit(null);
          setDailyFitError(err instanceof Error ? err.message : 'Daily Fit unavailable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, wardrobe, selectedOccasion, dailyFitVariation, selectedCity, isLiveLocation, liveCoordinates]);

  // --- Auth ---------------------------------------------------------------
  const login = async (emailOrUsername: string, password: string) => {
    setAuthError(null);
    try {
      await api.auth.login({ username_or_email: emailOrUsername.trim(), password });
      const user = await api.auth.getMe();
      setCurrentUserState(user);
      syncSettingsFromUser(user);

      Promise.allSettled([
        api.wardrobe.list().then(setWardrobe),
        api.posts.listFeed().then(setPosts),
        api.saved.listCollections().then(setCollections),
        api.notifications.list().then(setNotifications),
      ]).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setAuthError(message);
      throw err;
    }
  };

  const register = async (data: { name: string; username: string; email: string; password: string }) => {
    setAuthError(null);
    try {
      await api.auth.register({
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        display_name: data.name.trim(),
      });
      const user = await api.auth.getMe();
      setCurrentUserState(user);
      syncSettingsFromUser(user);

      Promise.allSettled([
        api.wardrobe.list().then(setWardrobe),
        api.posts.listFeed().then(setPosts),
        api.saved.listCollections().then(setCollections),
        api.notifications.list().then(setNotifications),
      ]).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setAuthError(message);
      throw err;
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setCurrentUserState(null);
    setWardrobe([]);
    setPosts([]);
    setCollections([]);
    setNotifications([]);
    setDailyFit(null);
    setDailyFitHistory([]);
    setFollowingIds([]);
  };

  // Wardrobe actions (POST/PATCH/DELETE → Neon, no local fallback)
  const addClothingItem = async (itemData: Omit<ClothingItem, 'id' | 'createdAt' | 'timesWorn'>) => {
    const created = await api.wardrobe.create(itemData);
    setWardrobe((prev) => [created, ...prev]);
    showToast(`Added "${created.name}" to your wardrobe!`, 'success');
    return created;
  };

  const updateClothingItem = async (item: ClothingItem) => {
    const updated = await api.wardrobe.update(item.id, item);
    setWardrobe((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    showToast(`Updated "${updated.name}"`, 'success');
  };

  const deleteClothingItem = async (id: string) => {
    const itemToDelete = wardrobe.find((i) => i.id === id);
    await api.wardrobe.delete(id);
    setWardrobe((prev) => prev.filter((i) => i.id !== id));
    if (currentUser) {
      setCurrentUserState({ ...currentUser, wardrobeCount: Math.max(0, (currentUser.wardrobeCount || 1) - 1) });
    }
    showToast(`Removed "${itemToDelete?.name || 'Item'}" from wardrobe`, 'info');
  };

  // Feed Actions (optimistic UI + backend write; rollback on failure)
  const toggleLikePost = async (postId: string) => {
    const target = posts.find((p) => p.id === postId);
    const willBeLiked = target ? !target.isLiked : true;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: willBeLiked,
              likesCount: willBeLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1),
            }
          : post
      )
    );
    if (willBeLiked) showToast('Liked outfit ✨', 'heart');
    try {
      if (willBeLiked) {
        await api.posts.toggleLike(postId);
      } else {
        await api.posts.unlike(postId);
      }
    } catch {
      // Roll back so UI never diverges from Neon.
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !willBeLiked,
                likesCount: !willBeLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1),
              }
            : post
        )
      );
      showToast('Could not update like. Please try again.', 'info');
      throw new Error('like-failed');
    }
  };

  const toggleSavePost = async (postId: string) => {
    const target = posts.find((p) => p.id === postId);
    const willBeSaved = target ? !target.isSaved : true;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isSaved: willBeSaved,
              savesCount: willBeSaved ? post.savesCount + 1 : Math.max(0, post.savesCount - 1),
            }
          : post
      )
    );
    if (willBeSaved) {
      showToast('Saved to your moodboard bookmark', 'save');
    } else {
      showToast('Removed from saved items', 'save');
    }
    try {
      if (willBeSaved) {
        await api.saved.savePost(postId);
      } else {
        await api.saved.unsavePost(postId);
      }
    } catch {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isSaved: !willBeSaved,
                savesCount: !willBeSaved ? post.savesCount + 1 : Math.max(0, post.savesCount - 1),
              }
            : post
        )
      );
      showToast('Could not update saved items. Please try again.', 'info');
      throw new Error('save-failed');
    }
  };

  const addCommentToPost = async (postId: string, text: string) => {
    if (!text.trim()) return;
    const created = await api.posts.addComment(postId, text.trim());

    setPosts((prev) => {
      const updated = prev.map((post) => {
        if (post.id === postId) {
          const newComment = {
            id: String(created.id || `comm_${Date.now()}`),
            postId,
            user: {
              id: currentUser?.id || '',
              name: currentUser?.name || 'You',
              username: currentUser?.username || 'you',
              avatar: currentUser?.avatar || '',
            },
            text: created.text || text.trim(),
            createdAt: 'Just now',
            likesCount: 0,
          };
          const comments = [newComment, ...(post.comments || [])];
          return {
            ...post,
            comments,
            commentsCount: comments.length,
          };
        }
        return post;
      });
      return updated;
    });
    showToast('Comment posted', 'success');
  };

  // Posts actions
  const publishPost = async (postData: {
    image: string;
    caption: string;
    tags: string[];
    occasion: Occasion;
    location?: string;
    taggedItemIds?: string[];
  }): Promise<Post> => {
    const created = await api.posts.create({
      caption: postData.caption,
      image_url: postData.image,
      location: postData.location,
      occasion: postData.occasion,
      tags: postData.tags,
      tagged_item_ids: postData.taggedItemIds || [],
    });
    setPosts((prev) => [created, ...prev]);
    showToast('Your outfit post is live on StyleSphere!', 'success');
    return created;
  };

  const deletePost = async (postId: string) => {
    try {
      await api.posts.delete(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast('Post deleted successfully', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete post', 'info');
      throw err;
    }
  };

  const updateProfile = async (data: {
    name?: string;
    bio?: string;
    avatar?: string;
    location?: string;
  }) => {
    try {
      const updatedUser = await api.users.updateProfile({
        display_name: data.name,
        bio: data.bio,
        profile_image_url: data.avatar,
        location: data.location,
      });
      setCurrentUserState(updatedUser);
      syncSettingsFromUser(updatedUser);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update profile', 'info');
      throw err;
    }
  };

  // Follow actions (persisted in Neon `follows`)
  const toggleFollowUser = async (userId: string) => {
    const isCurrentlyFollowing = followingIds.includes(userId);
    if (isCurrentlyFollowing) {
      await api.social.unfollow(userId);
      setFollowingIds((prev) => prev.filter((id) => id !== userId));
      showToast('Unfollowed', 'info');
      return false;
    }
    await api.social.follow(userId);
    setFollowingIds((prev) => [...prev, userId]);
    showToast('Followed creator', 'info');
    return true;
  };

  const isFollowingUser = (userId: string) => {
    return followingIds.includes(userId);
  };

  // Daily fit actions (feedback persisted in Neon; wear counts updated server-side)
  const wearDailyFit = async () => {
    if (!dailyFit) return;
    await api.recommendations.sendFeedback(dailyFit.id, 'wear');
    setDailyFit((prev) => (prev ? { ...prev, wornStatus: 'worn' as const } : prev));
    setDailyFitHistory((prev) => [
      { ...dailyFit, wornStatus: 'worn' as const },
      ...prev.filter((h) => h.id !== dailyFit.id),
    ]);
    // Re-fetch wardrobe so server-side wear_count increments are reflected.
    try {
      setWardrobe(await api.wardrobe.list());
    } catch {
      // Non-fatal: the counts refresh on next load.
    }
    showToast('Logged today’s fit! Wear count updated.', 'success');
  };

  const cycleDailyFit = () => {
    setDailyFitVariation((v) => v + 1);
    showToast('Generated fresh combination', 'info');
  };

  // Collections (persisted in Neon)
  const createCollection = async (name: string, description?: string, coverImage?: string) => {
    const col = await api.saved.createCollection(name, description);
    setCollections((prev) => [col, ...prev]);
    showToast(`Collection "${name}" created!`, 'success');
    return col;
  };

  // Notifications (persisted in Neon)
  const markNotificationAsRead = async (id: string) => {
    await api.notifications.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const markAllNotificationsAsRead = async () => {
    await api.notifications.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showToast('All notifications marked as read', 'info');
  };

  // Settings — persisted through FastAPI into Neon (no localStorage).
  const updateUserSettings = async (newSettings: UserSettings) => {
    const previousUser = currentUser;
    if (!previousUser) {
      setUserSettings(newSettings);
      return;
    }

    try {
      const updatedUser = await api.users.updateProfile({
        display_name: newSettings.account.name,
        bio: newSettings.account.bio,
        profile_image_url: previousUser.avatar,
        location: newSettings.account.location,
      });
      await api.users.updatePreferences({
        styles: newSettings.preferences.styles,
        favorite_colors: newSettings.preferences.preferredColors,
        preferred_categories: newSettings.preferences.favoriteCategories,
      });
      setUserSettings(newSettings);
      setCurrentUserState(updatedUser);
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      // Roll back so the UI never diverges from Neon.
      if (previousUser) {
        setUserSettings((prev) => ({
          ...prev,
          account: {
            name: previousUser.name,
            username: previousUser.username,
            email: previousUser.email,
            bio: previousUser.bio,
            location: previousUser.location || '',
          },
        }));
        setCurrentUserState(previousUser);
      }
      showToast(err instanceof Error ? err.message : 'Could not save settings.', 'info');
      throw err;
    }
  };

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
        isBootstrapping,
        authError,
        login,
        register,
        logout,
        wardrobe,
        posts,
        collections,
        notifications,
        unreadNotifsCount,
        dailyFit,
        dailyFitHistory,
        dailyFitError,
        weather,
        isWeatherLoading,
        weatherError,
        isLiveLocation,
        liveCoordinates,
        toggleLiveLocation,
        selectedCity,
        setSelectedCity,
        selectedOccasion,
        setSelectedOccasion,
        userSettings,
        updateUserSettings,
        updateProfile,
        theme,
        setTheme,
        toasts,
        showToast,
        dismissToast,
        addClothingItem,
        updateClothingItem,
        deleteClothingItem,
        toggleLikePost,
        toggleSavePost,
        addCommentToPost,
        publishPost,
        deletePost,
        toggleFollowUser,
        isFollowingUser,
        wearDailyFit,
        cycleDailyFit,
        createCollection,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        allCreators: [],
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

/**
 * Returns the signed-in user as a non-nullable `User`.
 *
 * Authenticated screens (everything wrapped in `AppShell`) render only after
 * `refreshData()` resolves a session, so the value is guaranteed there. While
 * bootstrapping we hand back a neutral placeholder to keep rendering safe
 * instead of forcing every consumer to null-check.
 */
export const useCurrentUser = (): User => {
  const { currentUser } = useApp();
  return currentUser ?? PLACEHOLDER_USER;
};
