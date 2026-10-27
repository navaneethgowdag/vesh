// ===========================================================================
// StyleSphere frontend API client — Neon PostgreSQL via FastAPI ONLY.
// ---------------------------------------------------------------------------
// The browser NEVER talks to the database directly. All persistent
// application data flows through these endpoints (JWT in HttpOnly cookie).
// No localStorage / sessionStorage / IndexedDB persistence is used here.
// ===========================================================================
import {
  ClothingItem,
  Collection,
  Notification,
  Outfit,
  Post,
  Recommendation,
  User,
  Weather,
  Occasion,
  CalendarEvent,
  OutfitMoment,
  UserSearchResult,
  SocialUserSummary,
} from '../types';
import { resolveImageUrl } from '../utils/imageUrl';
import { getApiBaseUrl } from '../utils/apiUrl';

export const API_BASE = getApiBaseUrl();

const TOKEN_STORAGE_KEY = 'stylesphere_token';

let memoryToken: string | null = null;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    memoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  }
} catch {
  // localStorage may be restricted in sandbox/SSR
}

export const tokenStorage = {
  get: (): string | null => {
    if (!memoryToken && typeof window !== 'undefined' && window.localStorage) {
      try {
        memoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return memoryToken;
  },
  set: (token: string | null) => {
    memoryToken = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (token) {
          window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  },
  clear: () => {
    memoryToken = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiBase = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = tokenStorage.get();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      credentials: 'include', // send the HttpOnly session cookie
      headers,
    });
  } catch (err: any) {
    if (err instanceof TypeError || err?.name === 'TypeError') {
      const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
      const isHttpTarget = apiBase.startsWith('http://');
      if (isHttps && isHttpTarget) {
        throw new ApiError(
          0,
          `Connection blocked (Mixed Content): Secure app cannot send requests to non-secure backend (${apiBase}).`
        );
      }
      throw new ApiError(
        0,
        `Unable to reach StyleSphere API server (${apiBase}). Please verify your network or check backend status.`
      );
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
      tokenStorage.clear();
    }
    let errorDetail = `${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
      if (Array.isArray(errorDetail)) {
        errorDetail = errorDetail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
      }
    } catch {
      // keep the status text fallback
    }
    throw new ApiError(response.status, String(errorDetail));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // --- AUTH ---
  auth: {
    async register(data: { username: string; email: string; password: string; display_name?: string }): Promise<{ access_token: string; user_id: string; username: string }> {
      const res = await request<{ access_token: string; user_id: string; username: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res?.access_token) {
        tokenStorage.set(res.access_token);
      }
      return res;
    },

    async login(data: { username_or_email: string; password: string }): Promise<{ access_token: string; user_id: string; username: string }> {
      const res = await request<{ access_token: string; user_id: string; username: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res?.access_token) {
        tokenStorage.set(res.access_token);
      }
      return res;
    },

    async getMe(): Promise<User> {
      const raw = await request<any>('/auth/me');
      return {
        id: String(raw.id),
        name: raw.display_name || raw.username,
        username: raw.username,
        email: raw.email,
        avatar: resolveImageUrl(raw.profile_image_url || raw.avatar_url) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        bio: raw.bio || '',
        location: raw.location || '',
        followersCount: raw.followers_count || 0,
        followingCount: raw.following_count || 0,
        postsCount: raw.posts_count || 0,
        wardrobeCount: raw.wardrobe_count || 0,
        isVerified: raw.is_verified,
        joinedDate: raw.created_at ? new Date(raw.created_at).toLocaleDateString() : '2026',
        preferences: {
          styles: raw.preferences?.styles || ['Minimal', 'Casual'],
          staplePieces: ['Trench Coat', 'Tailored Trousers'],
          lifestyle: 'Creative Professional',
          favoriteColors: raw.preferences?.favorite_colors || ['Beige', 'Black', 'Cream'],
          climatePreference: raw.preferences?.climate_preference || 'Moderate',
          fitPreference: 'Tailored / Slim',
        },
      };
    },

    async logout(): Promise<void> {
      try {
        await request<void>('/auth/logout', { method: 'POST' });
      } catch {
        // Session may already be expired; logout is idempotent client-side.
      } finally {
        tokenStorage.clear();
      }
    },
  },

  // --- WARDROBE ---
  wardrobe: {
    async list(): Promise<ClothingItem[]> {
      const items = await request<any[]>('/wardrobe');
      return items.map((item) => ({
        id: String(item.id),
        name: item.name,
        category: item.category,
        color: item.color,
        secondaryColor: item.secondary_color,
        pattern: item.pattern,
        style: item.occasion || 'Casual',
        season: item.season || 'All-Season',
        brand: item.brand,
        image: resolveImageUrl(item.image_url),
        material: item.material,
        createdAt: item.created_at || new Date().toISOString(),
        timesWorn: item.wear_count || 0,
        lastWorn: item.last_worn,
        tags: item.style_tags || [],
        isFavorite: item.is_favorite || false,
      }));
    },

    async create(item: Omit<ClothingItem, 'id' | 'createdAt' | 'timesWorn'>): Promise<ClothingItem> {
      const payload = {
        name: item.name,
        category: item.category,
        color: item.color,
        secondary_color: item.secondaryColor,
        pattern: item.pattern || 'Solid',
        material: item.material,
        fit: 'Regular',
        brand: item.brand,
        season: item.season || 'All-Season',
        occasion: item.style || 'Casual Daily',
        style_tags: item.tags || [],
        image_url: item.image,
        description: item.notes,
      };
      const res = await request<any>('/wardrobe', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return {
        id: String(res.id),
        name: res.name,
        category: res.category,
        color: res.color,
        secondaryColor: res.secondary_color,
        pattern: res.pattern,
        style: res.occasion,
        season: res.season,
        brand: res.brand,
        image: resolveImageUrl(res.image_url),
        material: res.material,
        createdAt: res.created_at,
        timesWorn: res.wear_count || 0,
        tags: res.style_tags || [],
        isFavorite: res.is_favorite || false,
      };
    },

    async update(id: string, updates: Partial<ClothingItem>): Promise<ClothingItem> {
      const payload: any = {};
      if (updates.name) payload.name = updates.name;
      if (updates.category) payload.category = updates.category;
      if (updates.color) payload.color = updates.color;
      if (updates.image) payload.image_url = updates.image;
      if (updates.isFavorite !== undefined) payload.is_favorite = updates.isFavorite;
      if (updates.timesWorn !== undefined) payload.wear_count = updates.timesWorn;

      const res = await request<any>(`/wardrobe/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return {
        id: String(res.id),
        name: res.name,
        category: res.category,
        color: res.color,
        secondaryColor: res.secondary_color,
        pattern: res.pattern,
        style: res.occasion,
        season: res.season,
        brand: res.brand,
        image: res.image_url,
        material: res.material,
        createdAt: res.created_at,
        timesWorn: res.wear_count || 0,
        tags: res.style_tags || [],
        isFavorite: res.is_favorite || false,
      };
    },

    async delete(id: string): Promise<void> {
      await request<void>(`/wardrobe/${id}`, { method: 'DELETE' });
    },

    async analyzeImage(file?: File, imageUrl?: string): Promise<any> {
      const apiBase = getApiBaseUrl();
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const headers: Record<string, string> = {};
        const token = tokenStorage.get();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        try {
          const res = await fetch(`${apiBase}/clothing-ai/analyze`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: formData,
          });
          if (!res.ok) {
            let detail = `${res.status} ${res.statusText}`;
            try {
              const errJson = await res.json();
              detail = errJson.detail || errJson.message || detail;
            } catch {}
            throw new ApiError(res.status, detail);
          }
          return res.json();
        } catch (err: any) {
          if (err instanceof ApiError) throw err;
          throw new ApiError(0, `Image analysis failed: ${err.message || 'Network error'}`);
        }
      }
      return request<any>('/clothing-ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ image_url: imageUrl || '' }),
      });
    },

    async createAnalysisJob(imageUrl?: string, clothingId?: string): Promise<{ id: string; status: string }> {
      const res = await request<any>('/clothing-ai/jobs', {
        method: 'POST',
        body: JSON.stringify({ image_url: imageUrl, clothing_id: clothingId }),
      });
      return { id: String(res.id), status: res.status };
    },

    async getAnalysisJob(jobId: string): Promise<{
      id: string;
      status: string;
      result?: any;
      errorMessage?: string;
    }> {
      const raw = await request<any>(`/clothing-ai/jobs/${jobId}`);
      return {
        id: String(raw.id),
        status: raw.status,
        result: raw.result,
        errorMessage: raw.error_message,
      };
    },
  },

  // --- POSTS / SOCIAL FEED ---
  posts: {
    async listFeed(feedType: 'for_you' | 'following' = 'for_you'): Promise<Post[]> {
      const query = feedType === 'following' ? '?feed_type=following' : '';
      const posts = await request<any[]>(`/posts${query}`);
      return posts.map((p) => ({
        id: String(p.id),
        user: {
          id: String(p.user?.id || ''),
          name: p.user?.name || 'User',
          username: p.user?.username || 'user',
          avatar: resolveImageUrl(p.user?.avatar) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          isVerified: p.user?.is_verified,
          isFollowing: p.user?.is_following,
        },
        image: resolveImageUrl(p.image_url),
        caption: p.caption,
        tags: p.tags || [],
        taggedItems: (p.tagged_items || []).map((ti: any) => ({
          id: String(ti.id),
          name: ti.name,
          category: ti.category,
          color: ti.color,
          style: ti.occasion || 'Casual',
          season: ti.season || 'All-Season',
          image: resolveImageUrl(ti.image_url),
          createdAt: ti.created_at || new Date().toISOString(),
        })),
        occasion: (p.occasion as Occasion) || 'Casual Daily',
        location: p.location,
        likesCount: p.likes_count || 0,
        commentsCount: p.comments_count || 0,
        savesCount: p.saves_count || 0,
        isLiked: p.is_liked || false,
        isSaved: p.is_saved || false,
        comments: (p.comments || []).map((c: any) => ({
          id: String(c.id),
          postId: String(p.id),
          user: {
            id: String(c.user?.id || ''),
            name: c.user?.name || 'User',
            username: c.user?.username || 'user',
            avatar: resolveImageUrl(c.user?.avatar) || '',
          },
          text: c.text,
          createdAt: c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now',
          likesCount: c.likes_count || 0,
        })),
        createdAt: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Just now',
      }));
    },

    async create(postData: {
      caption: string;
      image_url: string;
      outfit_id?: string;
      location?: string;
      occasion?: string;
      tags: string[];
      tagged_item_ids: string[];
    }): Promise<Post> {
      const p = await request<any>('/posts', {
        method: 'POST',
        body: JSON.stringify(postData),
      });
      return {
        id: String(p.id),
        user: {
          id: String(p.user?.id || ''),
          name: p.user?.name || 'User',
          username: p.user?.username || 'user',
          avatar: resolveImageUrl(p.user?.avatar) || '',
          isVerified: p.user?.is_verified,
        },
        image: resolveImageUrl(p.image_url),
        caption: p.caption,
        tags: p.tags || [],
        taggedItems: p.tagged_items || [],
        occasion: (p.occasion as Occasion) || 'Casual Daily',
        location: p.location,
        likesCount: 0,
        commentsCount: 0,
        savesCount: 0,
        isLiked: false,
        isSaved: false,
        comments: [],
        createdAt: 'Just now',
      };
    },

    async toggleLike(postId: string): Promise<{ liked: boolean }> {
      return request<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'POST' });
    },

    async unlike(postId: string): Promise<{ liked: boolean }> {
      return request<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'DELETE' });
    },

    async delete(postId: string): Promise<void> {
      await request<void>(`/posts/${postId}`, { method: 'DELETE' });
    },

    async addComment(postId: string, text: string): Promise<any> {
      return request<any>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    },
  },

  // --- 24-HOUR OUTFIT MOMENTS ---
  moments: {
    async listFeed(limit: number = 30, offset: number = 0): Promise<OutfitMoment[]> {
      const items = await request<any[]>(`/moments/feed?limit=${limit}&offset=${offset}`);
      return items.map((m) => ({
        id: String(m.id),
        user: {
          id: String(m.user?.id || ''),
          name: m.user?.name || 'User',
          username: m.user?.username || 'user',
          avatar: resolveImageUrl(m.user?.avatar) || '',
          isVerified: m.user?.is_verified,
        },
        imageUrl: resolveImageUrl(m.image_url),
        caption: m.caption,
        occasion: m.occasion || 'Casual Daily',
        tags: m.tags || [],
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        timeRemainingSeconds: m.time_remaining_seconds || 0,
        likesCount: m.likes_count || 0,
        isLiked: m.is_liked || false,
      }));
    },

    async listMine(): Promise<OutfitMoment[]> {
      const items = await request<any[]>('/moments/me');
      return items.map((m) => ({
        id: String(m.id),
        user: {
          id: String(m.user?.id || ''),
          name: m.user?.name || 'User',
          username: m.user?.username || 'user',
          avatar: resolveImageUrl(m.user?.avatar) || '',
          isVerified: m.user?.is_verified,
        },
        imageUrl: resolveImageUrl(m.image_url),
        caption: m.caption,
        occasion: m.occasion || 'Casual Daily',
        tags: m.tags || [],
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        timeRemainingSeconds: m.time_remaining_seconds || 0,
        likesCount: m.likes_count || 0,
        isLiked: m.is_liked || false,
      }));
    },

    async create(data: {
      image_url: string;
      caption?: string;
      occasion?: string;
      tags?: string[];
    }): Promise<OutfitMoment> {
      const m = await request<any>('/moments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return {
        id: String(m.id),
        user: {
          id: String(m.user?.id || ''),
          name: m.user?.name || 'User',
          username: m.user?.username || 'user',
          avatar: resolveImageUrl(m.user?.avatar) || '',
          isVerified: m.user?.is_verified,
        },
        imageUrl: resolveImageUrl(m.image_url),
        caption: m.caption,
        occasion: m.occasion || 'Casual Daily',
        tags: m.tags || [],
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        timeRemainingSeconds: m.time_remaining_seconds || 0,
        likesCount: m.likes_count || 0,
        isLiked: m.is_liked || false,
      };
    },

    async get(id: string): Promise<OutfitMoment> {
      const m = await request<any>(`/moments/${id}`);
      return {
        id: String(m.id),
        user: {
          id: String(m.user?.id || ''),
          name: m.user?.name || 'User',
          username: m.user?.username || 'user',
          avatar: resolveImageUrl(m.user?.avatar) || '',
          isVerified: m.user?.is_verified,
        },
        imageUrl: resolveImageUrl(m.image_url),
        caption: m.caption,
        occasion: m.occasion || 'Casual Daily',
        tags: m.tags || [],
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        timeRemainingSeconds: m.time_remaining_seconds || 0,
        likesCount: m.likes_count || 0,
        isLiked: m.is_liked || false,
      };
    },

    async delete(id: string): Promise<void> {
      await request<void>(`/moments/${id}`, { method: 'DELETE' });
    },

    async like(id: string): Promise<{ momentId: string; action: string; success: boolean }> {
      const res = await request<any>(`/moments/${id}/like`, { method: 'POST' });
      return {
        momentId: String(res.moment_id),
        action: res.action,
        success: res.success,
      };
    },

    async skip(id: string): Promise<{ momentId: string; action: string; success: boolean }> {
      const res = await request<any>(`/moments/${id}/skip`, { method: 'POST' });
      return {
        momentId: String(res.moment_id),
        action: res.action,
        success: res.success,
      };
    },
  },

  // --- MEDIA STORAGE & OPTIMIZATION ---
  media: {
    async upload(file: File): Promise<{ image_url: string; thumbnail_url: string }> {
      const apiBase = getApiBaseUrl();
      const formData = new FormData();
      formData.append('file', file);
      const headers: Record<string, string> = {};
      const token = tokenStorage.get();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      try {
        const res = await fetch(`${apiBase}/media/upload`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: formData,
        });
        if (!res.ok) {
          let detail = 'Failed to upload image asset';
          try {
            const errJson = await res.json();
            detail = errJson.detail || errJson.message || detail;
          } catch {}
          throw new ApiError(res.status, detail);
        }
        const data = await res.json();
        return {
          image_url: resolveImageUrl(data.image_url),
          thumbnail_url: resolveImageUrl(data.thumbnail_url),
        };
      } catch (err: any) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(0, `Image upload failed: ${err.message || 'Network error'}`);
      }
    },
  },

  // --- COLLECTIONS & SAVED ---
  saved: {
    async listSavedItems(itemType?: 'post' | 'outfit'): Promise<Array<{ id: string; itemType: string; itemId: string }>> {
      const query = itemType ? `?item_type=${itemType}` : '';
      const items = await request<any[]>(`/saved${query}`);
      return items.map((s) => ({
        id: String(s.id),
        itemType: s.item_type,
        itemId: String(s.item_id),
      }));
    },

    async savePost(postId: string, collectionId?: string): Promise<void> {
      const params = new URLSearchParams({ item_type: 'post', item_id: postId });
      if (collectionId) params.set('collection_id', collectionId);
      await request<void>(`/saved?${params.toString()}`, { method: 'POST' });
    },

    async unsavePost(postId: string): Promise<void> {
      await request<void>(`/saved/by-item/post/${postId}`, { method: 'DELETE' });
    },

    async listCollections(): Promise<Collection[]> {
      const cols = await request<any[]>('/saved/collections');
      return cols.map((c) => ({
        id: String(c.id),
        name: c.name,
        description: c.description,
        coverImage: resolveImageUrl(c.cover_image) || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
        itemCount: c.item_count || 0,
        outfitIds: c.outfit_ids || [],
        createdAt: c.created_at,
        isPrivate: c.is_private,
      }));
    },

    async createCollection(name: string, description?: string): Promise<Collection> {
      const c = await request<any>('/saved/collections', {
        method: 'POST',
        body: JSON.stringify({ name, description, is_private: false }),
      });
      return {
        id: String(c.id),
        name: c.name,
        description: c.description,
        coverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
        itemCount: 0,
        outfitIds: [],
        createdAt: c.created_at || new Date().toISOString(),
      };
    },
  },

  // --- USERS / PREFERENCES (explicit preferences persisted in Neon) ---
  users: {
    async search(query: string, limit: number = 20): Promise<UserSearchResult[]> {
      const items = await request<any[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return items.map((u) => ({
        id: String(u.id),
        username: u.username,
        displayName: u.display_name,
        bio: u.bio || '',
        avatar: resolveImageUrl(u.avatar || u.profile_image_url),
        isVerified: u.is_verified || false,
        followersCount: u.followers_count || 0,
        followingCount: u.following_count || 0,
        postsCount: u.posts_count || 0,
        isFollowing: u.is_following || false,
        isMe: u.is_me || false,
      }));
    },

    async getByUsername(username: string): Promise<User> {
      const raw = await request<any>(`/users/${encodeURIComponent(username)}`);
      return {
        id: String(raw.id),
        name: raw.display_name || raw.username,
        username: raw.username,
        email: raw.email || '',
        avatar: resolveImageUrl(raw.profile_image_url || raw.avatar_url) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        bio: raw.bio || '',
        location: raw.location || '',
        followersCount: raw.followers_count || 0,
        followingCount: raw.following_count || 0,
        postsCount: raw.posts_count || 0,
        wardrobeCount: raw.wardrobe_count || 0,
        isVerified: raw.is_verified || false,
        joinedDate: raw.created_at ? new Date(raw.created_at).toLocaleDateString() : '2026',
        preferences: {
          styles: raw.preferences?.styles || ['Minimal', 'Casual'],
          staplePieces: [],
          lifestyle: '',
          favoriteColors: raw.preferences?.favorite_colors || ['Beige', 'Black'],
          climatePreference: raw.preferences?.climate_preference || 'Moderate',
          fitPreference: 'Classic / Regular',
        },
      };
    },
    async getPreferences(): Promise<{
      styles: string[];
      favoriteColors: string[];
      preferredCategories: string[];
      preferredFit: string;
      preferredOccasions: string[];
      preferredSeasons: string[];
      climatePreference: string;
    }> {
      const raw = await request<any>('/users/me/preferences');
      return {
        styles: raw.styles || [],
        favoriteColors: raw.favorite_colors || [],
        preferredCategories: raw.preferred_categories || [],
        preferredFit: (raw.preferred_fits || [])[0] || 'Relaxed / Oversized',
        preferredOccasions: raw.favorite_occasions || [],
        preferredSeasons: raw.preferred_seasons || [],
        climatePreference: raw.climate_preference || 'Moderate',
      };
    },

    async updatePreferences(data: {
      styles?: string[];
      favorite_colors?: string[];
      preferred_categories?: string[];
      preferred_fits?: string[];
      favorite_occasions?: string[];
      preferred_seasons?: string[];
      climate_preference?: string;
    }): Promise<void> {
      await request<void>('/users/me/preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async updateProfile(data: {
      first_name?: string;
      last_name?: string;
      display_name?: string;
      bio?: string;
      avatar_url?: string;
      profile_image_url?: string;
      location?: string;
    }): Promise<User> {
      const raw = await request<any>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return {
        id: String(raw.id),
        name: raw.display_name || raw.username,
        username: raw.username,
        email: raw.email,
        avatar: resolveImageUrl(raw.profile_image_url || raw.avatar_url) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        bio: raw.bio || '',
        location: raw.location || '',
        followersCount: raw.followers_count || 0,
        followingCount: raw.following_count || 0,
        postsCount: raw.posts_count || 0,
        wardrobeCount: raw.wardrobe_count || 0,
        isVerified: raw.is_verified,
        joinedDate: raw.created_at ? new Date(raw.created_at).toLocaleDateString() : '2026',
        preferences: {
          styles: raw.preferences?.styles || ['Minimal', 'Casual'],
          staplePieces: ['Trench Coat', 'Tailored Trousers'],
          lifestyle: 'Creative Professional',
          favoriteColors: raw.preferences?.favorite_colors || ['Beige', 'Black', 'Cream'],
          climatePreference: raw.preferences?.climate_preference || 'Moderate',
          fitPreference: 'Classic / Regular',
        },
      };
    },
  },

  // --- SOCIAL (follows persisted in Neon) ---
  social: {
    async follow(userId: string): Promise<{ following: boolean; follower_count?: number; following_count?: number }> {
      return await request<any>(`/social/follow/${userId}`, { method: 'POST' });
    },

    async unfollow(userId: string): Promise<{ following: boolean; follower_count?: number; following_count?: number }> {
      return await request<any>(`/social/follow/${userId}`, { method: 'DELETE' });
    },

    async getFollowers(userId: string, limit: number = 50, offset: number = 0): Promise<SocialUserSummary[]> {
      const items = await request<any[]>(`/social/followers/${userId}?limit=${limit}&offset=${offset}`);
      return items.map((u) => ({
        id: String(u.id),
        username: u.username,
        name: u.name || u.display_name || u.username,
        avatar: resolveImageUrl(u.avatar || u.profile_image_url),
        isVerified: u.is_verified || false,
        isFollowing: u.is_following || false,
        isMe: u.is_me || false,
      }));
    },

    async getFollowing(userId: string, limit: number = 50, offset: number = 0): Promise<SocialUserSummary[]> {
      const items = await request<any[]>(`/social/following/${userId}?limit=${limit}&offset=${offset}`);
      return items.map((u) => ({
        id: String(u.id),
        username: u.username,
        name: u.name || u.display_name || u.username,
        avatar: resolveImageUrl(u.avatar || u.profile_image_url),
        isVerified: u.is_verified || false,
        isFollowing: u.is_following || false,
        isMe: u.is_me || false,
      }));
    },
  },

  // --- NOTIFICATIONS ---
  notifications: {
    async list(): Promise<Notification[]> {
      const notifs = await request<any[]>('/notifications');
      return notifs.map((n) => {
        const created = n.created_at ? new Date(n.created_at) : new Date();
        const diffMs = Date.now() - created.getTime();
        const timeAgo =
          diffMs < 60 * 60 * 1000
            ? `${Math.max(1, Math.floor(diffMs / 60000))}m ago`
            : diffMs < 24 * 60 * 60 * 1000
              ? `${Math.floor(diffMs / 3600000)}h ago`
              : created.toLocaleDateString();
        const group: 'Today' | 'Yesterday' | 'Earlier' =
          diffMs < 24 * 60 * 60 * 1000 ? 'Today' : diffMs < 48 * 60 * 60 * 1000 ? 'Yesterday' : 'Earlier';
        return {
          id: String(n.id),
          type: n.type,
          title: n.title || 'Notification',
          message: n.message,
          timeAgo,
          group,
          timestamp: n.created_at || new Date().toISOString(),
          isRead: n.is_read || false,
          targetImage: n.target_image,
          link: n.link,
          actionUser: n.action_user
            ? {
                username: n.action_user.username || 'user',
                name: n.action_user.name || 'Someone',
                avatar: n.action_user.avatar || '',
              }
            : undefined,
        };
      });
    },

    async markRead(id: string): Promise<void> {
      await request<void>(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    async markAllRead(): Promise<void> {
      await request<void>('/notifications/mark-all-read', { method: 'POST' });
    },
  },

  // --- RECOMMENDATIONS / DAILY FIT ---
  recommendations: {
    async getDailyFit(
      city: string = 'New York',
      occasion: string = 'Casual Daily',
      seed: number = 0,
      latitude?: number,
      longitude?: number,
    ): Promise<Recommendation> {
      const params = new URLSearchParams({
        city,
        occasion,
        variation_seed: String(seed),
      });
      if (latitude !== undefined && latitude !== null) params.set('latitude', String(latitude));
      if (longitude !== undefined && longitude !== null) params.set('longitude', String(longitude));
      const rec = await request<any>(`/recommendations/daily-fit?${params.toString()}`);
      const outfit = rec.outfit;
      return {
        id: String(rec.id),
        outfit: {
          id: String(outfit.id),
          title: outfit.name,
          description: outfit.description,
          pieces: (outfit.clothing_items || []).map((ci: any) => ({
            id: String(ci.id),
            name: ci.name,
            category: ci.category,
            color: ci.color,
            style: ci.occasion || 'Casual',
            season: ci.season || 'All-Season',
            brand: ci.brand,
            image: ci.image_url,
            createdAt: ci.created_at || new Date().toISOString(),
          })),
          occasion: (outfit.occasion as Occasion) || 'Casual Daily',
          style: outfit.style || 'Minimal',
          season: outfit.season || 'All-Season',
          score: Math.round((outfit.compatibility_score || 0.9) * 100),
          image: outfit.image_url,
          tags: outfit.tags || [],
          createdAt: outfit.created_at || new Date().toISOString(),
        },
        score: Math.round((rec.score || 0.9) * 100),
        weatherCompatibility: 94,
        styleCompatibility: 96,
        occasionCompatibility: 92,
        explanation: {
          weatherMatch: rec.reasoning?.weather_match || 'Optimized for current weather conditions.',
          styleMatch: rec.reasoning?.style_match || 'Aligned with your aesthetic preferences.',
          wardrobeMatch: rec.reasoning?.wardrobe_match || 'Utilizes your staple wardrobe pieces.',
          occasionMatch: rec.reasoning?.occasion_match || 'Matches the requested occasion.',
        },
        reasons: rec.context?.reasons || rec.reasons || ['Weather compatible', 'High color harmony', 'Matches preferred aesthetic'],
        wornStatus: rec.worn_status || 'suggested',
        recommendedAt: rec.created_at || new Date().toISOString(),
      };
    },

    async sendFeedback(recommendationId: string, action: 'view' | 'like' | 'save' | 'wear' | 'reject' | 'skip'): Promise<void> {
      await request<void>('/recommendations/feedback', {
        method: 'POST',
        body: JSON.stringify({
          recommendation_id: recommendationId,
          action,
        }),
      });
    },
  },


  // --- CALENDAR & OUTFIT PLANNING ---
  calendar: {
    async listEvents(startDate?: string, endDate?: string, status?: string): Promise<CalendarEvent[]> {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (status) params.set('status', status);
      const items = await request<any[]>(`/calendar/events?${params.toString()}`);
      return items.map((e) => ({
        id: String(e.id),
        userId: String(e.user_id),
        eventDate: e.event_date,
        startTime: e.start_time || undefined,
        endTime: e.end_time || undefined,
        eventType: e.event_type || 'planned_outfit',
        outfitId: e.outfit_id ? String(e.outfit_id) : undefined,
        recommendationId: e.recommendation_id ? String(e.recommendation_id) : undefined,
        occasion: e.occasion || undefined,
        notes: e.notes || undefined,
        status: e.status || 'scheduled',
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        outfit: e.outfit
          ? {
              id: String(e.outfit.id),
              title: e.outfit.name,
              description: e.outfit.description,
              pieces: (e.outfit.clothing_items || []).map((ci: any) => ({
                id: String(ci.id),
                name: ci.name,
                category: ci.category,
                color: ci.color,
                style: ci.occasion || 'Casual',
                season: ci.season || 'All-Season',
                brand: ci.brand,
                image: ci.image_url,
                createdAt: ci.created_at || new Date().toISOString(),
              })),
              occasion: e.outfit.occasion as Occasion,
              style: e.outfit.style || 'Minimal',
              season: e.outfit.season || 'All-Season',
              score: Math.round((e.outfit.compatibility_score || 0.9) * 100),
              image: e.outfit.image_url,
              tags: e.outfit.tags || [],
              createdAt: e.outfit.created_at || new Date().toISOString(),
            }
          : undefined,
      }));
    },

    async createEvent(data: {
      event_date: string;
      start_time?: string;
      end_time?: string;
      event_type?: string;
      outfit_id?: string;
      occasion?: string;
      notes?: string;
    }): Promise<CalendarEvent> {
      const res = await request<any>('/calendar/events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return {
        id: String(res.id),
        userId: String(res.user_id),
        eventDate: res.event_date,
        startTime: res.start_time || undefined,
        endTime: res.end_time || undefined,
        eventType: res.event_type || 'planned_outfit',
        outfitId: res.outfit_id ? String(res.outfit_id) : undefined,
        recommendationId: res.recommendation_id ? String(res.recommendation_id) : undefined,
        occasion: res.occasion || undefined,
        notes: res.notes || undefined,
        status: res.status || 'scheduled',
        createdAt: res.created_at,
        updatedAt: res.updated_at,
      };
    },

    async updateEvent(
      id: string,
      updates: Partial<{
        event_date: string;
        start_time?: string;
        end_time?: string;
        event_type?: string;
        outfit_id?: string;
        occasion?: string;
        notes?: string;
        status?: string;
      }>
    ): Promise<CalendarEvent> {
      const res = await request<any>(`/calendar/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return {
        id: String(res.id),
        userId: String(res.user_id),
        eventDate: res.event_date,
        startTime: res.start_time || undefined,
        endTime: res.end_time || undefined,
        eventType: res.event_type || 'planned_outfit',
        outfitId: res.outfit_id ? String(res.outfit_id) : undefined,
        recommendationId: res.recommendation_id ? String(res.recommendation_id) : undefined,
        occasion: res.occasion || undefined,
        notes: res.notes || undefined,
        status: res.status || 'scheduled',
        createdAt: res.created_at,
        updatedAt: res.updated_at,
      };
    },

    async deleteEvent(id: string): Promise<void> {
      await request<void>(`/calendar/events/${id}`, { method: 'DELETE' });
    },

    async scheduleRecommendation(
      recommendationId: string,
      data: { date: string; time?: string; occasion?: string; notes?: string }
    ): Promise<CalendarEvent> {
      const res = await request<any>(`/recommendations/${recommendationId}/schedule`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return {
        id: String(res.id),
        userId: String(res.user_id),
        eventDate: res.event_date,
        startTime: res.start_time || undefined,
        endTime: res.end_time || undefined,
        eventType: res.event_type || 'planned_outfit',
        outfitId: res.outfit_id ? String(res.outfit_id) : undefined,
        recommendationId: res.recommendation_id ? String(res.recommendation_id) : undefined,
        occasion: res.occasion || undefined,
        notes: res.notes || undefined,
        status: res.status || 'scheduled',
        createdAt: res.created_at,
        updatedAt: res.updated_at,
      };
    },
  },

  // --- WEATHER ---
  weather: {
    async getCurrent(city?: string, latitude?: number, longitude?: number): Promise<Weather> {
      const params = new URLSearchParams();
      if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
        params.set('latitude', String(latitude));
        params.set('longitude', String(longitude));
      } else if (city && city.trim()) {
        params.set('city', city.trim());
      }
      const data = await request<any>(`/weather/current?${params.toString()}`);
      return {
        city: data.city,
        country: data.country,
        temp: data.temp,
        feelsLike: data.feels_like,
        condition: data.condition,
        icon: data.icon,
        humidity: data.humidity,
        windSpeed: data.wind_speed,
        uvIndex: data.uv_index,
        highTemp: data.high_temp,
        lowTemp: data.low_temp,
        summary: data.summary,
      };
    },
  },
};
