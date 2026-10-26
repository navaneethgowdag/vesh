import { User } from '../types';

export const CURRENT_USER: User = {
  id: '',
  name: '',
  username: '',
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

export const MOCK_CREATORS: User[] = [];
