export type ClothingCategory =
  | 'Tops'
  | 'Bottoms'
  | 'Dresses'
  | 'Outerwear'
  | 'Shoes'
  | 'Accessories'
  | 'Bags';

export type StyleVibe =
  | 'Minimal'
  | 'Casual'
  | 'Streetwear'
  | 'Formal'
  | 'Vintage'
  | 'Sporty'
  | 'Smart Casual'
  | 'Trendy'
  | 'Boho'
  | 'Old Money'
  | 'Classic'
  | 'Quiet Luxury';

export type Occasion =
  | 'Casual Daily'
  | 'Work & Office'
  | 'Date Night'
  | 'Weekend Outing'
  | 'Party & Evening'
  | 'Travel & Airport'
  | 'Gym & Active'
  | 'Formal Event';

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'All-Season';

export type ClothingColor =
  | 'White'
  | 'Black'
  | 'Beige'
  | 'Brown'
  | 'Cognac'
  | 'Navy'
  | 'Grey'
  | 'Olive'
  | 'Sage'
  | 'Denim Blue'
  | 'Terracotta'
  | 'Burgundy'
  | 'Cream'
  | 'Pastel Pink';

export interface StylePreference {
  styles: StyleVibe[];
  staplePieces: string[];
  lifestyle: string;
  favoriteColors: string[];
  climatePreference: 'Warm' | 'Moderate' | 'Cool';
  fitPreference: 'Relaxed / Oversized' | 'Tailored / Slim' | 'Classic / Regular';
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  location?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  wardrobeCount: number;
  isFollowing?: boolean;
  isVerified?: boolean;
  preferences: StylePreference;
  joinedDate: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: ClothingColor;
  secondaryColor?: string;
  pattern?: string;
  style: StyleVibe;
  season: Season;
  brand?: string;
  image: string;
  material?: string;
  notes?: string;
  createdAt: string;
  timesWorn?: number;
  lastWorn?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface OutfitPieceReference {
  slot: 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessory' | 'bag';
  item: ClothingItem;
}

export interface Outfit {
  id: string;
  title: string;
  description?: string;
  pieces: ClothingItem[];
  occasion: Occasion;
  style: StyleVibe;
  season: Season;
  weatherFitTemp?: number;
  score?: number;
  image?: string;
  tags: string[];
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface Post {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
    isFollowing?: boolean;
  };
  image: string;
  caption: string;
  tags: string[];
  taggedItems?: ClothingItem[];
  occasion: Occasion;
  location?: string;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  comments?: Comment[];
  createdAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage: string;
  itemCount: number;
  outfitIds: string[];
  createdAt: string;
  isPrivate?: boolean;
}

export interface Weather {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  condition: 'Sunny' | 'Partly Cloudy' | 'Cloudy' | 'Light Rain' | 'Breezy' | 'Clear Night';
  icon: string;
  humidity: number;
  windSpeed: number; // km/h
  uvIndex: number;
  highTemp: number;
  lowTemp: number;
  summary: string;
}

export interface RecommendationExplanation {
  weatherMatch: string;
  styleMatch: string;
  wardrobeMatch: string;
  occasionMatch: string;
}

export interface Recommendation {
  id: string;
  outfit: Outfit;
  score: number;
  weatherCompatibility: number;
  styleCompatibility: number;
  occasionCompatibility: number;
  explanation: RecommendationExplanation;
  reasons: string[];
  recommendedAt: string;
  wornStatus?: 'suggested' | 'worn' | 'skipped';
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'daily_fit' | 'milestone' | 'collection_save';
  title: string;
  message: string;
  timeAgo: string;
  group: 'Today' | 'Yesterday' | 'Earlier';
  timestamp: string;
  isRead: boolean;
  avatar?: string;
  targetImage?: string;
  link?: string;
  actionUser?: {
    username: string;
    name: string;
    avatar: string;
  };
}

export interface UserSettings {
  account: {
    name: string;
    username: string;
    email: string;
    bio: string;
    location: string;
  };
  preferences: {
    styles: StyleVibe[];
    preferredColors: ClothingColor[];
    clothingSizes: {
      tops: string;
      bottoms: string;
      shoes: string;
    };
    favoriteCategories: ClothingCategory[];
  };
  notifications: {
    likes: boolean;
    comments: boolean;
    followers: boolean;
    dailyRecommendations: boolean;
    emailDigest: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
  };
  privacy: {
    isPrivateAccount: boolean;
    showActivity: boolean;
    allowDirectMessages: boolean;
  };
}


export interface CalendarEvent {
  id: string;
  userId: string;
  eventDate: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  eventType: 'planned_outfit' | 'outfit_worn' | 'special_event';
  outfitId?: string;
  recommendationId?: string;
  occasion?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  outfit?: Outfit;
}
