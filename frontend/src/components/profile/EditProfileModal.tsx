import React, { useState } from 'react';
import { X, User, MapPin, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { updateProfile } = useApp();
  const currentUser = useCurrentUser();

  const [name, setName] = useState(currentUser.name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a display name.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        avatar: avatar.trim(),
        location: location.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 sm:p-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Edit Profile
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Update your public persona, avatar, and style location.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Preview & URL */}
          <div className="flex items-center gap-4 p-4 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
            <Avatar src={avatar || currentUser.avatar} alt={name || currentUser.name} size="xl" />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Profile Image URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md pl-8 pr-3 py-2 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                <ImageIcon className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          {/* Full Name / Display Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alice Vane"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Location / City
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New York, NY"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Style Bio
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your personal style philosophy or favorite aesthetic..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-3 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
              />
              <FileText className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              className="min-h-[44px]"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
