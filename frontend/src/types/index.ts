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
  gender?: string;
  avatarStyle?: string;
  onboarding_completed?: boolean;
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
  wearCountSinceWash?: number;
  wear_count_since_wash?: number;
  lastWornOn?: string;
  last_worn_on?: string;
  laundryStatus?: 'clean' | 'in_laundry' | 'unavailable';
  laundry_status?: 'clean' | 'in_laundry' | 'unavailable';
  laundryStartedOn?: string;
  laundry_started_on?: string;
  availableFrom?: string;
  available_from?: string;
  maxWearsOverride?: number | null;
  max_wears_override?: number | null;
  washDaysOverride?: number | null;
  wash_days_override?: number | null;
  trackLaundry?: boolean;
  track_laundry?: boolean;
}

export interface CategoryLaundryOverride {
  max_wears?: number;
  wash_days?: number;
  track_laundry?: boolean;
}

export interface LaundrySettings {
  default_max_wears: number;
  default_wash_days: number;
  category_overrides: Record<string, CategoryLaundryOverride>;
  same_item_cooldown_days: number;
  auto_return_from_laundry: boolean;
}

export type ProcessingStage =
  | 'uploaded'
  | 'queued'
  | 'claimed_by_worker'
  | 'analyzing_clothing'
  | 'predictions_ready'
  | 'removing_background'
  | 'preparing_catalog_image'
  | 'understanding_garment'
  | 'image_processing_completed'
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
    name?: string;
    article_type?: string;
    master_category?: string;
    sub_category?: string;
    gender?: string;
    base_colour?: string;
    usage?: string;
    age_group?: string;
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
  name?: string;
  description?: string;
  pieces: ClothingItem[];
  clothing_items?: any[];
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

export interface PollOption {
  id: string;
  poll_id?: string;
  option_text: string;
  display_order: number;
  vote_count?: number | null;
  percentage?: number | null;
}

export interface PollCreatorSummary {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  is_verified?: boolean;
}

export interface Poll {
  id: string;
  creator_user_id: string;
  question: string;
  content_type: 'standalone' | 'post' | 'moment';
  parent_post_id?: string | null;
  parent_moment_id?: string | null;
  post_id?: string | null;
  expires_at: string;
  is_expired: boolean;
  time_remaining_seconds: number;
  allow_vote_change: boolean;
  show_results_before_vote: boolean;
  allow_creator_vote: boolean;
  total_votes?: number | null;
  has_voted: boolean;
  user_voted_option_id?: string | null;
  options: PollOption[];
  created_at: string;
  creator?: PollCreatorSummary | null;
}

export interface CreatePollPayload {
  question: string;
  options: string[];
  duration_hours?: number;
  expires_at?: string;
  allow_vote_change?: boolean;
  show_results_before_vote?: boolean;
  allow_creator_vote?: boolean;
  content_type?: 'standalone' | 'post' | 'moment';
  post_id?: string;
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
  image_url?: string;
  caption: string;
  tags: string[];
  taggedItems?: ClothingItem[];
  occasion: Occasion;
  location?: string;
  likesCount: number;
  likes_count?: number;
  commentsCount: number;
  savesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  comments?: Comment[];
  poll?: Poll;
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
  status?: 'active' | 'no_items' | 'partial_outfit' | 'stale';
  emptyReason?: {
    message: string;
    action?: string;
    earliest_return?: string;
    missing_slots?: string[];
    filter_counts?: Record<string, any>;
  };
  empty_reason?: {
    message: string;
    action?: string;
    earliest_return?: string;
    missing_slots?: string[];
    filter_counts?: Record<string, any>;
  };
  canWear?: boolean;
  can_wear?: boolean;
  missingSlots?: string[];
  missing_slots?: string[];
  filterCounts?: Record<string, any>;
  filter_counts?: Record<string, any>;
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
  userId?: string;
  user_id?: string;
  eventDate?: string; // YYYY-MM-DD
  event_date?: string; // YYYY-MM-DD
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  eventType?: 'planned_outfit' | 'outfit_worn' | 'special_event' | string;
  event_type?: 'planned_outfit' | 'outfit_worn' | 'special_event' | string;
  outfitId?: string;
  outfit_id?: string;
  recommendationId?: string;
  recommendation_id?: string;
  occasion?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  outfit?: Outfit;

  // Google Calendar extension
  title?: string;
  description?: string;
  location?: string;
  timezone?: string;
  isAllDay?: boolean;
  is_all_day?: boolean;
  googleCalendarId?: string;
  google_calendar_id?: string;
  googleEventId?: string;
  google_event_id?: string;
  eventSource?: 'google' | 'tailorbird' | string;
  event_source?: 'google' | 'tailorbird' | string;
  lastSyncedAt?: string;
  last_synced_at?: string;

  // Inferred Fashion & Context
  inferredOccasion?: string;
  inferred_occasion?: string;
  inferredFormality?: number;
  inferred_formality?: number;
  inferredDressCode?: string;
  inferred_dress_code?: string;
  inferredContext?: Record<string, any>;
  inferred_context?: Record<string, any>;
}

export interface GoogleCalendarStatus {
  is_connected: boolean;
  google_email?: string;
  selected_calendars: string[];
  last_sync_time?: string;
  sync_status: 'idle' | 'syncing' | 'error' | string;
  last_sync_error?: string;
  event_count: number;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

export interface GoogleCalendarSyncResult {
  status: string;
  synced_at: string;
  events_imported: number;
  events_updated: number;
  events_cancelled: number;
  message: string;
}

export interface DayAgendaSummary {
  date: string;
  event_count: number;
  events: CalendarEvent[];
  is_outfit_change_recommended: boolean;
  reason: string;
  suggested_overall_occasion: string;
  suggested_dress_code: string;
  formality_range: number[];
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
  location?: string;
  tags?: string[];
  createdAt: string;
  expiresAt: string;
  timeRemainingSeconds: number;
  secondsRemaining?: number;
  weatherSummary?: string;
  likesCount: number;
  isLiked: boolean;
  poll?: Poll;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  gender?: string;
  avatarStyle?: string;
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
  isVerified?: boolean;
  is_verified?: boolean;
  isFollowing?: boolean;
  is_following?: boolean;
  isMe?: boolean;
  is_me?: boolean;
}



// ==========================================
// Communities, Messaging & Explore Types
// ==========================================

export interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  cover_image_url?: string;
  coverImageUrl?: string;
  category: string;
  rules?: string;
  visibility: 'public' | 'private';
  owner: SocialUserSummary;
  members_count: number;
  membersCount?: number;
  is_member: boolean;
  isMember?: boolean;
  membership_role?: 'owner' | 'moderator' | 'member';
  membershipRole?: 'owner' | 'moderator' | 'member';
  membership_status?: 'active' | 'pending' | 'rejected';
  membershipStatus?: 'active' | 'pending' | 'rejected';
  created_at: string;
  createdAt?: string;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user: SocialUserSummary;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'rejected';
  joined_at: string;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  shared_by: SocialUserSummary;
  title?: string;
  message?: string;
  post?: Post;
  poll?: Poll;
  is_pinned: boolean;
  created_at: string;
}

export interface SharedContentPreview {
  content_type: 'post' | 'poll' | 'community';
  id: string;
  title_or_caption?: string;
  image_url?: string;
  author_name?: string;
  extra?: Record<string, any>;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: SocialUserSummary;
  message_type: 'text' | 'post_share' | 'poll_share' | 'community_share';
  text_content?: string;
  shared_content?: SharedContentPreview;
  created_at: string;
}

export interface ConversationParticipant {
  id: string;
  user: SocialUserSummary;
  role: string;
  joined_at: string;
  last_read_at?: string;
}

export interface Conversation {
  id: string;
  conversation_type: 'direct' | 'group';
  title?: string;
  image_url?: string;
  participants: ConversationParticipant[];
  other_participant?: SocialUserSummary;
  last_message?: Message;
  unread_count: number;
  updated_at: string;
  created_at: string;
}

export interface ExplorePostItem {
  item_type: 'post' | 'poll' | 'community_post';
  post?: Post;
  poll?: Poll;
  community?: Community;
}

export interface TrendingPostItem {
  post: Post;
  score: number;
  rank: number;
}

export interface RecommendedPerson {
  user: SocialUserSummary;
  match_reason: string;
  mutual_followers_count: number;
  common_styles: string[];
}

// ---------------------------------------------------------------------------
// Weekly Outfit Planner Types
// ---------------------------------------------------------------------------
export type WeeklyDayStatus = 'planned' | 'accepted' | 'rejected' | 'worn' | 'needs_manual_selection';

export interface WeeklyPlanDay {
  id: string;
  weekly_plan_id: string;
  plan_date: string;
  outfit_id?: string;
  outfit?: Outfit;
  calendar_event_id?: string;
  status: WeeklyDayStatus;
  recommendation_explanation?: string;
  explanation_data?: {
    summary?: string;
    reasons?: string[];
    score?: number;
    reasoning?: Record<string, any>;
    context?: {
      weather?: string;
      temperature?: number;
      occasion?: string;
      season?: string;
      event_category?: string;
      dress_code?: string;
      color_harmony?: string;
      color_explanation?: string;
      color_swatches?: ColorSwatch[];
      contrast_balance?: string;
      reasons?: string[];
    };
    needs_items?: boolean;
    manual?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
  days: WeeklyPlanDay[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Wardrobe Gap Analysis Types
// ---------------------------------------------------------------------------
export interface WardrobeGapItem {
  category: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  evidence: string;
  occasions: string[];
  suggested_garments: string[];
  confidence: number;
}

export interface WardrobeGapAnalysis {
  total_items: number;
  category_distribution: Record<string, number>;
  formality_distribution: {
    casual: number;
    smart_casual: number;
    formal: number;
  };
  color_distribution: {
    neutrals: number;
    accents: number;
    breakdown?: Record<string, number>;
  };
  occasions_distribution?: Record<string, number>;
  wear_stats: {
    recently_worn_30_days?: number;
    unworn_garments?: number;
    recently_worn?: number;
    never_or_rarely_worn?: number;
  };
  gaps: WardrobeGapItem[];
  last_analyzed_at: string;
  is_balanced: boolean;
}

// ---------------------------------------------------------------------------
// Colour Coordination Types
// ---------------------------------------------------------------------------
export interface ColorSwatch {
  garment_id?: string;
  garment_name?: string;
  color_name: string;
  normalized?: string;
  hex: string;
  is_neutral: boolean;
  category: string;
}

