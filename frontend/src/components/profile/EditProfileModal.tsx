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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-cream-50 rounded-3xl border border-sand-200 shadow-soft-2xl overflow-hidden p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-sand-200 mb-6">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-950">
              Edit Profile
            </h2>
            <p className="text-xs text-charcoal-500 mt-0.5">
              Update your public persona, avatar, and style location.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-700 rounded-full hover:bg-sand-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Preview & URL */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-sand-100/70 border border-sand-200">
            <Avatar src={avatar || currentUser.avatar} alt={name || currentUser.name} size="xl" />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-charcoal-700 mb-1">
                Profile Image URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full bg-cream-50 border border-sand-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                />
                <ImageIcon className="w-3.5 h-3.5 text-charcoal-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Full Name / Display Name */}
          <div>
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alice Vane"
                className="w-full bg-cream-50 border border-sand-300 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 shadow-soft-xs"
              />
              <User className="w-4 h-4 text-charcoal-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              Location / City
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New York, NY"
                className="w-full bg-cream-50 border border-sand-300 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 shadow-soft-xs"
              />
              <MapPin className="w-4 h-4 text-charcoal-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              Style Bio
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your personal style philosophy or favorite aesthetic..."
                className="w-full bg-cream-50 border border-sand-300 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 shadow-soft-xs resize-none"
              />
              <FileText className="w-4 h-4 text-charcoal-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

