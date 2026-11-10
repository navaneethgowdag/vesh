// ===========================================================================
// Canonical Occasion Taxonomy & Wardrobe Constants
// Matches backend/app/core/taxonomy.py as the single source of truth.
// ===========================================================================

export interface OccasionItem {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultFormality: number;
}

export interface OccasionCategoryGroup {
  name: string;
  categoryKey: string;
  occasions: OccasionItem[];
}

export const CANONICAL_OCCASION_GROUPS: OccasionCategoryGroup[] = [
  {
    name: 'Daily & Casual',
    categoryKey: 'daily_casual',
    occasions: [
      {
        id: 'everyday',
        name: 'Everyday',
        category: 'Daily and Casual',
        description: 'Casual daily wear for relaxed routines and errands.',
        defaultFormality: 0.25,
      },
      {
        id: 'home',
        name: 'Home',
        category: 'Daily and Casual',
        description: 'Loungewear and comfortable home clothing.',
        defaultFormality: 0.1,
      },
      {
        id: 'casual_outing',
        name: 'Casual Outing',
        category: 'Daily and Casual',
        description: 'Cafes, daytime shopping, and meeting friends casually.',
        defaultFormality: 0.35,
      },
      {
        id: 'weekend_outing',
        name: 'Weekend Outing',
        category: 'Daily and Casual',
        description: 'Weekend brunches, day trips, and laid-back plans.',
        defaultFormality: 0.4,
      },
      {
        id: 'college',
        name: 'College',
        category: 'Daily and Casual',
        description: 'Campus wear, lectures, and relaxed student life.',
        defaultFormality: 0.3,
      },
      {
        id: 'family_gathering',
        name: 'Family Gathering',
        category: 'Daily and Casual',
        description: 'Family luncheons, dinners, and gatherings.',
        defaultFormality: 0.5,
      },
    ],
  },
  {
    name: 'Professional & Academic',
    categoryKey: 'professional_academic',
    occasions: [
      {
        id: 'office',
        name: 'Office',
        category: 'Professional and Academic',
        description: 'Standard office workday and smart business attire.',
        defaultFormality: 0.7,
      },
      {
        id: 'business_meeting',
        name: 'Business Meeting',
        category: 'Professional and Academic',
        description: 'Client presentations, executive meetings, and pitches.',
        defaultFormality: 0.8,
      },
      {
        id: 'presentation',
        name: 'Presentation',
        category: 'Professional and Academic',
        description: 'On-stage speaking, keynote sessions, and team reviews.',
        defaultFormality: 0.75,
      },
      {
        id: 'interview',
        name: 'Interview',
        category: 'Professional and Academic',
        description: 'Job interview and high-stakes professional evaluations.',
        defaultFormality: 0.85,
      },
      {
        id: 'conference',
        name: 'Conference',
        category: 'Professional and Academic',
        description: 'Industry summits, networking events, and expos.',
        defaultFormality: 0.75,
      },
      {
        id: 'professional_event',
        name: 'Professional Event',
        category: 'Professional and Academic',
        description: 'Corporate dinners, award ceremonies, and galas.',
        defaultFormality: 0.8,
      },
    ],
  },
  {
    name: 'Social & Evening',
    categoryKey: 'social_evening',
    occasions: [
      {
        id: 'date_night',
        name: 'Date Night',
        category: 'Social and Evening',
        description: 'Romantic dinners, stylish dates, and cocktails.',
        defaultFormality: 0.65,
      },
      {
        id: 'dinner',
        name: 'Dinner',
        category: 'Social and Evening',
        description: 'Upscale dinners and evening outings.',
        defaultFormality: 0.6,
      },
      {
        id: 'party_night_out',
        name: 'Party & Night Out',
        category: 'Social and Evening',
        description: 'Clubs, lounge parties, and nightlife celebrations.',
        defaultFormality: 0.6,
      },
      {
        id: 'birthday_celebration',
        name: 'Birthday & Celebration',
        category: 'Social and Evening',
        description: 'Birthday celebrations and milestone parties.',
        defaultFormality: 0.55,
      },
    ],
  },
  {
    name: 'Formal & Special',
    categoryKey: 'formal_special',
    occasions: [
      {
        id: 'formal_event',
        name: 'Formal Event',
        category: 'Formal and Special',
        description: 'Black tie, formal banquets, and red carpet events.',
        defaultFormality: 0.9,
      },
      {
        id: 'gala_black_tie',
        name: 'Gala & Black Tie',
        category: 'Formal and Special',
        description: 'Charity galas, black-tie dinners, and luxury galas.',
        defaultFormality: 0.95,
      },
      {
        id: 'wedding',
        name: 'Wedding',
        category: 'Formal and Special',
        description: 'Wedding ceremony, nuptials, and formal wedding attire.',
        defaultFormality: 0.9,
      },
      {
        id: 'wedding_reception',
        name: 'Wedding Reception',
        category: 'Formal and Special',
        description: 'Post-wedding celebrations and receptions.',
        defaultFormality: 0.85,
      },
      {
        id: 'engagement',
        name: 'Engagement',
        category: 'Formal and Special',
        description: 'Engagement ceremonies and celebratory toasts.',
        defaultFormality: 0.8,
      },
    ],
  },
  {
    name: 'Traditional & Festive',
    categoryKey: 'traditional_festive',
    occasions: [
      {
        id: 'festival_cultural',
        name: 'Festival & Cultural',
        category: 'Traditional and Festive',
        description: 'Diwali, Eid, Puja, and celebratory cultural festivals.',
        defaultFormality: 0.75,
      },
      {
        id: 'cultural_event',
        name: 'Cultural Event',
        category: 'Traditional and Festive',
        description: 'Ethnic community functions and heritage celebrations.',
        defaultFormality: 0.7,
      },
    ],
  },
  {
    name: 'Functional & Active',
    categoryKey: 'functional_active',
    occasions: [
      {
        id: 'gym_workout',
        name: 'Gym & Workout',
        category: 'Functional and Active',
        description: 'Indoor fitness, weight training, and athletic workouts.',
        defaultFormality: 0.1,
      },
      {
        id: 'running',
        name: 'Running',
        category: 'Functional and Active',
        description: 'Outdoor jogging, marathons, and running sessions.',
        defaultFormality: 0.1,
      },
      {
        id: 'sports',
        name: 'Sports',
        category: 'Functional and Active',
        description: 'Tennis, basketball, badminton, and outdoor sports.',
        defaultFormality: 0.15,
      },
    ],
  },
  {
    name: 'Travel',
    categoryKey: 'travel',
    occasions: [
      {
        id: 'travel_airport',
        name: 'Travel & Airport',
        category: 'Travel',
        description: 'Long-haul flights, transit comfort, and airport style.',
        defaultFormality: 0.35,
      },
      {
        id: 'vacation',
        name: 'Vacation',
        category: 'Travel',
        description: 'Holiday resort wear, sightseeing, and relaxation.',
        defaultFormality: 0.35,
      },
    ],
  },
  {
    name: 'Other',
    categoryKey: 'other',
    occasions: [
      {
        id: 'solemn_memorial',
        name: 'Solemn & Memorial',
        category: 'Other',
        description: 'Funerals, memorials, and solemn ceremonies.',
        defaultFormality: 0.7,
      },
      {
        id: 'custom_occasion',
        name: 'Custom Occasion',
        category: 'Other',
        description: 'Customized occasion specified with custom requirements.',
        defaultFormality: 0.5,
      },
    ],
  },
];

// Flat list of all canonical occasions
export const ALL_CANONICAL_OCCASIONS: OccasionItem[] = CANONICAL_OCCASION_GROUPS.flatMap(
  (group) => group.occasions
);

// Quick lookup map: display name -> OccasionItem
export const OCCASION_BY_NAME = new Map<string, OccasionItem>(
  ALL_CANONICAL_OCCASIONS.map((occ) => [occ.name.toLowerCase(), occ])
);

// Quick lookup map: id -> OccasionItem
export const OCCASION_BY_ID = new Map<string, OccasionItem>(
  ALL_CANONICAL_OCCASIONS.map((occ) => [occ.id, occ])
);

// Wardrobe Collection Groups
export interface WardrobeGroupOption {
  key: string;
  name: string;
  description: string;
}

export const WARDROBE_COLLECTION_GROUPS: WardrobeGroupOption[] = [
  {
    key: 'daily_work',
    name: 'Daily & Work',
    description: 'Everyday rotation, campus, and office essentials.',
  },
  {
    key: 'party_evening',
    name: 'Party & Evening',
    description: 'Cocktail looks, nightlife, and dinner outfits.',
  },
  {
    key: 'luxury_special',
    name: 'Luxury & Special',
    description: 'High-value gala garments, bridal attire, and designer pieces.',
  },
  {
    key: 'traditional_festive',
    name: 'Traditional & Festive',
    description: 'Ethnic wear, festival garments, and heritage attire.',
  },
];

// Attendee roles for Event Preparation
export const EVENT_ATTENDEE_ROLES = [
  { key: 'guest', name: 'Guest / Attendee' },
  { key: 'close_family', name: 'Close Family / Host' },
  { key: 'wedding_party', name: 'Wedding Party / Bridesmaid / Groomsman' },
  { key: 'groom_bride', name: 'Groom / Bride' },
  { key: 'speaker', name: 'Keynote Speaker / Presenter' },
] as const;

// Care type options
export const CARE_TYPE_OPTIONS = [
  { key: 'machine_wash', label: 'Machine Wash' },
  { key: 'hand_wash', label: 'Hand Wash Delicate' },
  { key: 'dry_clean_only', label: 'Dry Clean Only' },
  { key: 'delicate', label: 'Special Delicate Care' },
] as const;

// Wear tiers
export const WEAR_TIER_OPTIONS = [
  { key: 'daily', label: 'Daily Rotation', description: 'Regular wear, frequent use' },
  { key: 'elevated', label: 'Elevated & Smart', description: 'Work, dates, smart casual' },
  { key: 'luxury_special', label: 'Special & Luxury', description: 'Weddings, galas, designer wear' },
] as const;
