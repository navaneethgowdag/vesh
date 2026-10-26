import {
  ClothingItem,
  Collection,
  Notification,
  Outfit,
  Post,
  Recommendation,
  User,
  UserSettings,
} from '../types';
import { CURRENT_USER } from '../data/users';
import { INITIAL_WARDROBE } from '../data/wardrobe';
import { INITIAL_POSTS } from '../data/posts';
import { INITIAL_COLLECTIONS } from '../data/collections';
import { INITIAL_NOTIFICATIONS } from '../data/notifications';
import { INITIAL_OUTFITS } from '../data/outfits';

const STORAGE_KEYS = {
  USER: 'stylesphere_user',
  WARDROBE: 'stylesphere_wardrobe',
  POSTS: 'stylesphere_posts',
  COLLECTIONS: 'stylesphere_collections',
  NOTIFICATIONS: 'stylesphere_notifications',
  OUTFITS: 'stylesphere_outfits',
  RECOMMENDATION_HISTORY: 'stylesphere_rec_history',
  FOLLOWING_IDS: 'stylesphere_following_ids',
  SETTINGS: 'stylesphere_settings',
  THEME: 'stylesphere_theme',
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage`, err);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage`, err);
  }
}

export const storageService = {
  // USER
  getUser(): User {
    return safeGet<User>(STORAGE_KEYS.USER, CURRENT_USER);
  },
  saveUser(user: User): void {
    safeSet(STORAGE_KEYS.USER, user);
  },

  // WARDROBE
  getWardrobe(): ClothingItem[] {
    return safeGet<ClothingItem[]>(STORAGE_KEYS.WARDROBE, INITIAL_WARDROBE);
  },
  saveWardrobe(items: ClothingItem[]): void {
    safeSet(STORAGE_KEYS.WARDROBE, items);
  },
  addClothingItem(item: ClothingItem): ClothingItem[] {
    const items = this.getWardrobe();
    const updated = [item, ...items];
    this.saveWardrobe(updated);
    return updated;
  },
  removeClothingItem(id: string): ClothingItem[] {
    const items = this.getWardrobe();
    const updated = items.filter((i) => i.id !== id);
    this.saveWardrobe(updated);
    return updated;
  },
  updateClothingItem(item: ClothingItem): ClothingItem[] {
    const items = this.getWardrobe();
    const updated = items.map((i) => (i.id === item.id ? item : i));
    this.saveWardrobe(updated);
    return updated;
  },

  // POSTS
  getPosts(): Post[] {
    return safeGet<Post[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
  },
  savePosts(posts: Post[]): void {
    safeSet(STORAGE_KEYS.POSTS, posts);
  },
  addPost(post: Post): Post[] {
    const posts = this.getPosts();
    const updated = [post, ...posts];
    this.savePosts(updated);
    return updated;
  },

  // COLLECTIONS
  getCollections(): Collection[] {
    return safeGet<Collection[]>(STORAGE_KEYS.COLLECTIONS, INITIAL_COLLECTIONS);
  },
  saveCollections(collections: Collection[]): void {
    safeSet(STORAGE_KEYS.COLLECTIONS, collections);
  },
  addCollection(collection: Collection): Collection[] {
    const collections = this.getCollections();
    const updated = [collection, ...collections];
    this.saveCollections(updated);
    return updated;
  },

  // NOTIFICATIONS
  getNotifications(): Notification[] {
    return safeGet<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  },
  saveNotifications(notifs: Notification[]): void {
    safeSet(STORAGE_KEYS.NOTIFICATIONS, notifs);
  },

  // OUTFITS
  getOutfits(): Outfit[] {
    return safeGet<Outfit[]>(STORAGE_KEYS.OUTFITS, INITIAL_OUTFITS);
  },
  saveOutfits(outfits: Outfit[]): void {
    safeSet(STORAGE_KEYS.OUTFITS, outfits);
  },

  // RECOMMENDATION HISTORY
  getRecommendationHistory(): Recommendation[] {
    return safeGet<Recommendation[]>(STORAGE_KEYS.RECOMMENDATION_HISTORY, []);
  },
  saveWornRecommendation(rec: Recommendation): Recommendation[] {
    const history = this.getRecommendationHistory();
    const markedRec: Recommendation = { ...rec, wornStatus: 'worn' };
    const updated = [markedRec, ...history.filter((h) => h.id !== rec.id)];
    safeSet(STORAGE_KEYS.RECOMMENDATION_HISTORY, updated);

    // Also increment wear count on pieces
    const wardrobe = this.getWardrobe();
    const pieceIds = new Set(rec.outfit.pieces.map((p) => p.id));
    const updatedWardrobe = wardrobe.map((item) => {
      if (pieceIds.has(item.id)) {
        return {
          ...item,
          timesWorn: (item.timesWorn || 0) + 1,
          lastWorn: new Date().toISOString().split('T')[0],
        };
      }
      return item;
    });
    this.saveWardrobe(updatedWardrobe);

    return updated;
  },

  // FOLLOWING
  getFollowingIds(): string[] {
    return safeGet<string[]>(STORAGE_KEYS.FOLLOWING_IDS, []);
  },
  toggleFollow(userId: string): { isFollowing: boolean; followingIds: string[] } {
    const ids = this.getFollowingIds();
    const isCurrentlyFollowing = ids.includes(userId);
    const updated = isCurrentlyFollowing ? ids.filter((id) => id !== userId) : [...ids, userId];
    safeSet(STORAGE_KEYS.FOLLOWING_IDS, updated);
    return { isFollowing: !isCurrentlyFollowing, followingIds: updated };
  },

  // SETTINGS
  getSettings(): UserSettings {
    const defaultSettings: UserSettings = {
      account: {
        name: CURRENT_USER.name,
        username: CURRENT_USER.username,
        email: CURRENT_USER.email,
        bio: CURRENT_USER.bio,
        location: CURRENT_USER.location || 'SoHo, New York',
      },
      preferences: {
        styles: CURRENT_USER.preferences.styles,
        preferredColors: ['Beige', 'Cream', 'Black', 'Cognac', 'White'],
        clothingSizes: {
          tops: 'M (Relaxed)',
          bottoms: '28 / 32',
          shoes: 'EU 39 / US 8.5',
        },
        favoriteCategories: ['Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Bags'],
      },
      notifications: {
        likes: true,
        comments: true,
        followers: true,
        dailyRecommendations: true,
        emailDigest: false,
      },
      appearance: {
        theme: 'light',
      },
      privacy: {
        isPrivateAccount: false,
        showActivity: true,
        allowDirectMessages: true,
      },
    };
    return safeGet<UserSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
  },
  saveSettings(settings: UserSettings): void {
    safeSet(STORAGE_KEYS.SETTINGS, settings);
  },

  // Reset demo data
  resetAll(): void {
    localStorage.clear();
  }
};

