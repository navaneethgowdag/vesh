import React, { useState } from 'react';
import { User, MapPin, FileText, Loader2 } from 'lucide-react';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { ProfilePhotoUploader } from './ProfilePhotoUploader';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { updateProfile } = useApp();
  const currentUser = useCurrentUser();

  const [name, setName] = useState(currentUser.name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      subtitle="Update your public persona, avatar, and style location."
      maxWidth="lg"
    >
      {error && (
        <div className="p-3 mb-4 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Direct Profile Photo Upload Component (BYTEA Storage) */}
        <ProfilePhotoUploader size="xl" />

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
            isLoading={isSubmitting}
            className="min-h-[44px]"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
