import masculineSvg from '../assets/avatars/masculine.svg';
import feminineSvg from '../assets/avatars/feminine.svg';
import androgynousSvg from '../assets/avatars/androgynous.svg';
import neutralSvg from '../assets/avatars/neutral.svg';

export type AvatarStyle = 'masculine' | 'feminine' | 'androgynous' | 'neutral';

export interface AvatarStyleOption {
  id: AvatarStyle;
  label: string;
  description: string;
  svg: string;
}

export const AVATAR_OPTIONS: AvatarStyleOption[] = [
  {
    id: 'neutral',
    label: 'Atelier Mannequin',
    description: 'Sartorial atelier dress form with minimalist silhouette',
    svg: neutralSvg,
  },
  {
    id: 'feminine',
    label: 'Sculpted Drape',
    description: 'Graceful flowing silhouette with sculpted drape lines',
    svg: feminineSvg,
  },
  {
    id: 'masculine',
    label: 'Tailored Structure',
    description: 'Clean angular silhouette with sharp tailored collar',
    svg: masculineSvg,
  },
  {
    id: 'androgynous',
    label: 'Architectural Form',
    description: 'Contemporary mock-neck silhouette with fluid lines',
    svg: androgynousSvg,
  },
];

export const DEFAULT_FACELESS_AVATAR = neutralSvg;

/**
 * Resolves the appropriate faceless vector avatar illustration based on optional
 * gender fallback and user avatarStyle customization.
 */
export function getDefaultAvatar(gender?: string | null, avatarStyle?: string | null): string {
  // Explicit avatarStyle choice takes top priority
  const styleKey = (avatarStyle || '').toLowerCase().trim();
  if (styleKey === 'masculine') return masculineSvg;
  if (styleKey === 'feminine') return feminineSvg;
  if (styleKey === 'androgynous') return androgynousSvg;
  if (styleKey === 'neutral') return neutralSvg;

  // Fallback to gender preference if set
  const genderKey = (gender || '').toLowerCase().trim();
  if (genderKey === 'masculine' || genderKey === 'male' || genderKey === 'man') return masculineSvg;
  if (genderKey === 'feminine' || genderKey === 'female' || genderKey === 'woman') return feminineSvg;
  if (genderKey === 'androgynous' || genderKey === 'non_binary' || genderKey === 'nonbinary') return androgynousSvg;

  // Sartorial Atelier Mannequin default
  return neutralSvg;
}
