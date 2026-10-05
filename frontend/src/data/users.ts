import { User } from '../types';

export const CURRENT_USER: User = {
  id: 'user-default',
  name: 'Elena Rostova',
  username: 'elena_r',
  email: 'elena.rostova@stylesphere.io',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  bio: 'Architectural lines, warm neutral palettes, and curated timeless staples.',
  location: 'SoHo, New York',
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
  wardrobeCount: 0,
  isVerified: true,
  joinedDate: 'October 2026',
  preferences: {
    styles: ['Minimal', 'Quiet Luxury', 'Classic'],
    staplePieces: ['Trench Coat', 'Tailored Trousers', 'Silk Blouse'],
    lifestyle: 'Creative Professional / Design',
    favoriteColors: ['Beige', 'Black', 'Cream', 'Cognac', 'Olive'],
    climatePreference: 'Moderate',
    fitPreference: 'Tailored / Slim',
  },
};

export const MOCK_CREATORS: User[] = [];
