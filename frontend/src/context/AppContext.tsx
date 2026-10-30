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

export type WeatherStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'permission_denied'
  | 'location_unavailable'
  | 'provider_unavailable';

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
  isGeneratingDailyFit: boolean;
  generateDailyFit: (targetVariation?: number, targetOccasion?: Occasion) => Promise<Recommendation | null>;
  weather: Weather;
  weatherStatus: WeatherStatus;
  isWeatherLoading: boolean;
  weatherError: string | null;
  requestWeather: (options?: { force?: boolean; city?: string; useGps?: boolean }) => Promise<Weather | null>;
  isLiveLocation: boolean;
  liveCoordinates: { latitude: number; longitude: number } | null;
  toggleLiveLocation: (enable?: boolean) => Promise<boolean>;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedOccasion: Occasion;
  setSelectedOccasion: (occ: Occasion) => void;
  userSettings: UserSettings;
  updateUserSettings: (s: UserSettings) => Promise<void>;
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
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
  followingIds: string[];
  wearDailyFit: () => Promise<void>;
  cycleDailyFit: () => void;
  createCollection: (name: string, description?: string, coverImage?: string) => Promise<Collection>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  allCreators: User[];
  refreshData: () => Promise<void>;
}

const INITIAL_WEATHER: Weather = {
  city: '',
  country: '',
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
    avoidedColors: [],
    dislikedStyles: [],
    personalizationEnabled: true,
    diversityPreference: 'balanced',
    avoidRecentlyWornDays: 7,
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
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    return localStorage.getItem('stylesphere_selected_city') || '';
  });
  const [selectedOccasion, setSelectedOccasionState] = useState<Occasion>('Casual Daily');
  const [weather, setWeather] = useState<Weather>({ ...INITIAL_WEATHER });
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isGeneratingDailyFit, setIsGeneratingDailyFit] = useState<boolean>(false);
  const [isLiveLocation, setIsLiveLocation] = useState<boolean>(() => {
    return localStorage.getItem('stylesphere_live_location') === 'true';
  });
  const [liveCoordinates, setLiveCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dailyFitVariation, setDailyFitVariation] = useState<number>(0);
  const [dailyFit, setDailyFit] = useState<Recommendation | null>(null);

  // Theme state: support 'light' | 'dark' | 'system'
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('stylesphere_theme') as 'light' | 'dark' | 'system') || 'light';
  });

  const applyTheme = useCallback((targetTheme: 'light' | 'dark' | 'system') => {
    const isDark =
      targetTheme === 'dark' ||
      (targetTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: 'light' | 'dark' | 'system') => {
      setThemeState(newTheme);
      try {
        localStorage.setItem('stylesphere_theme', newTheme);
      } catch {}
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  useEffect(() => {
    applyTheme(theme);
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, applyTheme]);

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

  const activeWeatherPromiseRef = React.useRef<Promise<Weather | null> | null>(null);
  const weatherCacheRef = React.useRef<{ weather: Weather; key: string; timestamp: number } | null>(null);

  // User-controlled on-demand weather request with caching and deduplication
  const requestWeather = useCallback(
    async (options?: { force?: boolean; city?: string; useGps?: boolean }): Promise<Weather | null> => {
      let targetLat: number | undefined = undefined;
      let targetLon: number | undefined = undefined;

      if (options?.useGps) {
        if (!navigator.geolocation) {
          setWeatherStatus('permission_denied');
          setWeatherError('Geolocation is not supported by your browser.');
          showToast('Geolocation is not supported by your browser.', 'info');
          return null;
        }

        setIsWeatherLoading(true);
        setWeatherStatus('loading');
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true,
            });
          });
          targetLat = pos.coords.latitude;
          targetLon = pos.coords.longitude;
          setLiveCoordinates({ latitude: targetLat, longitude: targetLon });
          setIsLiveLocation(true);
          try {
            localStorage.setItem('stylesphere_live_location', 'true');
          } catch {}
        } catch (geoErr: any) {
          setIsLiveLocation(false);
          setLiveCoordinates(null);
          try {
            localStorage.setItem('stylesphere_live_location', 'false');
          } catch {}
          setWeatherStatus('permission_denied');
          const deniedMsg =
            geoErr?.code === 1
              ? 'Location permission denied. Please choose your city manually.'
              : 'Location request timed out. Please choose your city manually.';
          setWeatherError(deniedMsg);
          setIsWeatherLoading(false);
          showToast(deniedMsg, 'info');
          return null;
        }
      } else if (isLiveLocation && liveCoordinates) {
        targetLat = liveCoordinates.latitude;
        targetLon = liveCoordinates.longitude;
      }

      const targetCity =
        options?.city?.trim() ||
        (targetLat === undefined
          ? selectedCity.trim() || currentUser?.location?.trim() || userSettings?.account?.location?.trim()
          : undefined);

      if (targetLat === undefined && !targetCity) {
        setWeatherStatus('location_unavailable');
        setWeatherError('Location not set. Please select a city or enable GPS.');
        return null;
      }

      const locationKey =
        targetLat !== undefined
          ? `geo_${targetLat.toFixed(3)}_${targetLon?.toFixed(3)}`
          : `city_${targetCity?.toLowerCase()}`;
      const now = Date.now();
      const CACHE_TTL_MS = 15 * 60 * 1000;

      if (
        !options?.force &&
        weatherCacheRef.current &&
        weatherCacheRef.current.key === locationKey &&
        now - weatherCacheRef.current.timestamp < CACHE_TTL_MS
      ) {
        setWeather(weatherCacheRef.current.weather);
        setWeatherStatus('available');
        setWeatherError(null);
        return weatherCacheRef.current.weather;
      }

      if (activeWeatherPromiseRef.current) {
        return activeWeatherPromiseRef.current;
      }

      setIsWeatherLoading(true);
      setWeatherStatus('loading');
      setWeatherError(null);

      const fetchPromise = (async () => {
        try {
          const w = await api.weather.getCurrent(targetCity, targetLat, targetLon);
          setWeather(w);
          setWeatherStatus('available');
          setWeatherError(null);
          weatherCacheRef.current = { weather: w, key: locationKey, timestamp: Date.now() };
          if (w.city && w.city !== selectedCity) {
            setSelectedCityState(w.city);
          }
          return w;
        } catch (err: any) {
          const errorMsg = err instanceof Error ? err.message : 'Live weather temporarily unavailable';
          setWeatherStatus('provider_unavailable');
          setWeatherError(errorMsg);
          return null;
        } finally {
          setIsWeatherLoading(false);
          activeWeatherPromiseRef.current = null;
        }
      })();

      activeWeatherPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    [isLiveLocation, liveCoordinates, selectedCity, currentUser?.location, userSettings?.account?.location, showToast]
  );

  const setSelectedCity = useCallback(
    (city: string) => {
      const clean = city.trim();
      setSelectedCityState(clean);
      try {
        if (clean) {
          localStorage.setItem('stylesphere_selected_city', clean);
        } else {
          localStorage.removeItem('stylesphere_selected_city');
        }
      } catch {}
      if (isLiveLocation) {
        setIsLiveLocation(false);
        setLiveCoordinates(null);
        try {
          localStorage.setItem('stylesphere_live_location', 'false');
        } catch {}
      }
      if (clean && weatherStatus !== 'idle') {
        requestWeather({ force: true, city: clean });
      }
    },
    [isLiveLocation, requestWeather, weatherStatus]
  );

  const toggleLiveLocation = useCallback(
    async (enable?: boolean): Promise<boolean> => {
      const shouldEnable = enable !== undefined ? enable : !isLiveLocation;
      if (!shouldEnable) {
        setIsLiveLocation(false);
        setLiveCoordinates(null);
        try {
          localStorage.setItem('stylesphere_live_location', 'false');
        } catch {}
        showToast('Live GPS disabled. Using manual city selection.', 'info');
        return false;
      }

      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'info');
        return false;
      }

      setIsWeatherLoading(true);
      return new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setLiveCoordinates(coords);
            setIsLiveLocation(true);
            try {
              localStorage.setItem('stylesphere_live_location', 'true');
            } catch {}
            try {
              const w = await api.weather.getCurrent(undefined, coords.latitude, coords.longitude);
              setWeather(w);
              if (w.city) {
                setSelectedCityState(w.city);
              }
              setWeatherStatus('available');
              setWeatherError(null);
              showToast(`Live GPS active: ${w.city} (${w.temp}°C)`, 'success');
              resolve(true);
            } catch (err) {
              setWeatherStatus('provider_unavailable');
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
            try {
              localStorage.setItem('stylesphere_live_location', 'false');
            } catch {}
            setIsWeatherLoading(false);
            setWeatherStatus('permission_denied');
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
    },
    [isLiveLocation, showToast]
  );

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
        avoidedColors: (user.preferences as any).avoided_colors || (user.preferences as any).disliked_colors || [],
        dislikedStyles: (user.preferences as any).disliked_styles || [],
        personalizationEnabled: (user.preferences as any).personalization_enabled !== false,
        diversityPreference: (user.preferences as any).diversity_preference || 'balanced',
        avoidRecentlyWornDays: (user.preferences as any).avoid_recently_worn_days || 7,
      },
    }));
    // If user has a saved location in profile and GPS is not active, use it
    if (user.location && !localStorage.getItem('stylesphere_selected_city') && localStorage.getItem('stylesphere_live_location') !== 'true') {
      setSelectedCityState(user.location);
    }
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

      const [items, feedPosts, cols, notifs, followingUsers] = await Promise.all([
        api.wardrobe.list().catch(() => []),
        api.posts.listFeed().catch(() => []),
        api.saved.listCollections().catch(() => []),
        api.notifications.list().catch(() => []),
        api.social.getFollowing(user.id).catch(() => []),
      ]);
      setWardrobe(items);
      setPosts(feedPosts);
      setCollections(cols);
      setNotifications(notifs);
      setFollowingIds(followingUsers.map((u) => u.id));
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

  // User-initiated daily fit recommendation generation (no automatic fetch on mount)
  const generateDailyFit = useCallback(
    async (targetVariation?: number, targetOccasion?: Occasion): Promise<Recommendation | null> => {
      if (!isAuthenticated || wardrobe.length === 0) {
        setDailyFit(null);
        return null;
      }
      setIsGeneratingDailyFit(true);
      setDailyFitError(null);

      const variationToUse = targetVariation !== undefined ? targetVariation : dailyFitVariation;
      const occasionToUse = targetOccasion || selectedOccasion;

      const lat = isLiveLocation && liveCoordinates ? liveCoordinates.latitude : undefined;
      const lon = isLiveLocation && liveCoordinates ? liveCoordinates.longitude : undefined;
      const targetCity = selectedCity.trim() || currentUser?.location?.trim() || undefined;

      try {
        const rec = await api.recommendations.getDailyFit(targetCity, occasionToUse, variationToUse, lat, lon);
        setDailyFit(rec);
        return rec;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : 'Daily Fit unavailable';
        setDailyFitError(msg);
        showToast(msg, 'info');
        return null;
      } finally {
        setIsGeneratingDailyFit(false);
      }
    },
    [
      isAuthenticated,
      wardrobe.length,
      dailyFitVariation,
      selectedOccasion,
      isLiveLocation,
      liveCoordinates,
      selectedCity,
      currentUser?.location,
      showToast,
    ]
  );

  const setSelectedOccasion = useCallback(
    (occ: Occasion) => {
      setSelectedOccasionState(occ);
      if (dailyFit) {
        generateDailyFit(dailyFitVariation, occ);
      }
    },
    [dailyFit, dailyFitVariation, generateDailyFit]
  );

  const cycleDailyFit = useCallback(() => {
    const nextVariation = dailyFitVariation + 1;
    setDailyFitVariation(nextVariation);
    generateDailyFit(nextVariation, selectedOccasion);
    showToast('Generated fresh combination', 'info');
  }, [dailyFitVariation, generateDailyFit, selectedOccasion, showToast]);

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
        api.social.getFollowing(user.id).then((users) => setFollowingIds(users.map((u) => u.id))),
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
        api.social.getFollowing(user.id).then((users) => setFollowingIds(users.map((u) => u.id))),
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
    const prevFollowingIds = [...followingIds];
    const prevFollowingCount = currentUser?.followingCount ?? 0;

    // Optimistic UI updates
    setFollowingIds((prev) =>
      isCurrentlyFollowing ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    if (currentUser) {
      setCurrentUserState((prev) =>
        prev
          ? {
              ...prev,
              followingCount: Math.max(0, prev.followingCount + (isCurrentlyFollowing ? -1 : 1)),
            }
          : prev
      );
    }

    try {
      if (isCurrentlyFollowing) {
        await api.social.unfollow(userId);
        showToast('Unfollowed', 'info');
        return false;
      } else {
        await api.social.follow(userId);
        showToast('Followed creator', 'info');
        return true;
      }
    } catch (err) {
      // Rollback on failure
      setFollowingIds(prevFollowingIds);
      if (currentUser) {
        setCurrentUserState((prev) =>
          prev ? { ...prev, followingCount: prevFollowingCount } : prev
        );
      }
      showToast(err instanceof Error ? err.message : 'Follow action failed', 'info');
      throw err;
    }
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
        avoided_colors: newSettings.preferences.avoidedColors || [],
        disliked_styles: newSettings.preferences.dislikedStyles || [],
        personalization_enabled: newSettings.preferences.personalizationEnabled !== false,
        diversity_preference: newSettings.preferences.diversityPreference || 'balanced',
        avoid_recently_worn_days: newSettings.preferences.avoidRecentlyWornDays || 7,
        preferred_categories: newSettings.preferences.favoriteCategories,
      });
      setUserSettings(newSettings);
      if (newSettings.appearance?.theme) {
        setTheme(newSettings.appearance.theme);
      }
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
        isGeneratingDailyFit,
        generateDailyFit,
        weather,
        weatherStatus,
        isWeatherLoading,
        weatherError,
        requestWeather,
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
        followingIds,
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
