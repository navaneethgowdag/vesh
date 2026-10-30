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
  processingStatus?: string;
  processingStage?: string;
  reviewRequired?: boolean;
  isProcessedAvailable?: boolean;
  originalImageUrl?: string;
  processedImageUrl?: string;
  preferredImageUrl?: string;
  isFinalized?: boolean;
  formality?: number;
  verifiedAttributes?: Record<string, any>;
  sleeveType?: string;
  neckline?: string;
  categoryGroup?: string;
}

export type ProcessingStage =
  | 'uploaded'
  | 'queued'
  | 'claimed_by_worker'
  | 'analyzing_clothing'
  | 'removing_background'
  | 'preparing_catalog_image'
  | 'understanding_garment'
  | 'ready_for_review'
  | 'completed'
  | 'failed';

export interface GarmentProcessingStatus {
  itemId: string;
  status: string;
  stage: ProcessingStage | string;
  reviewRequired: boolean;
  isProcessedAvailable: boolean;
  durationSeconds: number;
  errorMessage?: string;
  originalImageUrl: string;
  processedImageUrl?: string;
}

export interface ColorPaletteItem {
  name: string;
  hex: string;
  percentage: number;
  rgb?: number[];
  delta_e?: number;
}

export interface CategoryAlternative {
  category: string;
  score: number;
  display_name: string;
}

export interface ClothingPrediction {
  id?: string;
  clothing_id: string;
  user_id?: string;
  model_name: string;
  model_version: string;
  input_image_source: string;
  predicted_category: string;
  category_group?: string;
  category_score: number;
  category_alternatives: CategoryAlternative[];
  predicted_attributes: Record<string, any>;
  prediction_scores: Record<string, any>;
  color_palette: ColorPaletteItem[];
  created_at?: string;
}

export interface ClothingCorrection {
  id: string;
  clothing_id: string;
  attribute_name: string;
  predicted_value?: string;
  corrected_value: string;
  created_at?: string;
}

export interface ClothingAttributesData {
  clothing_id: string;
  is_finalized: boolean;
  current_attributes: {
    category: string;
    category_group?: string;
    category_display?: string;
    primary_color: string;
    primary_hex?: string;
    secondary_color?: string;
    secondary_hex?: string;
    pattern?: string;
    style?: string;
    season?: string;
    occasion?: string;
    formality?: number;
    fabric?: string;
    brand?: string;
    category_specific?: Record<string, any>;
  };
  original_prediction?: ClothingPrediction;
  corrections_count: number;
  corrections: ClothingCorrection[];
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

export interface LearnedPreferences {
  id?: string;
  userId?: string;
  user_id?: string;
  styleScores?: Record<string, number>;
  colorScores?: Record<string, number>;
  style_scores?: Record<string, number>;
  color_scores?: Record<string, number>;
  categoryScores?: Record<string, number>;
  occasionScores?: Record<string, number>;
  seasonScores?: Record<string, number>;
  confidenceScore?: number;
  confidence?: number;
  interactionCount?: number;
  total_interactions?: number;
  topStyles?: Array<{ name?: string; style?: string; score: number }>;
  top_styles?: Array<{ name?: string; style?: string; score: number }>;
  topColors?: Array<{ name?: string; color?: string; score: number }>;
  top_colors?: Array<{ name?: string; color?: string; score: number }>;
  evidence_summary?: string;
  updatedAt?: string;
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
    avoidedColors?: string[];
    dislikedStyles?: string[];
    personalizationEnabled?: boolean;
    diversityPreference?: 'balanced' | 'high' | 'low';
    avoidRecentlyWornDays?: number;
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

export interface OutfitMoment {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
  imageUrl: string;
  caption?: string;
  occasion?: string;
  tags?: string[];
  createdAt: string;
  expiresAt: string;
  timeRemainingSeconds: number;
  secondsRemaining?: number;
  weatherSummary?: string;
  likesCount: number;
  isLiked: boolean;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  isVerified: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isMe: boolean;
}

export interface SocialUserSummary {
  id: string;
  username: string;
  name: string;
  avatar: string;
  isVerified: boolean;
  isFollowing: boolean;
  isMe: boolean;
}

