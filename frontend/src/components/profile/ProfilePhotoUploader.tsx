import React, { useState, useRef } from 'react';
import { Camera, Trash2, Check, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { getDefaultAvatar } from '../../utils/avatarHelper';
import { useApp, useCurrentUser } from '../../context/AppContext';

export interface ProfilePhotoUploaderProps {
  currentAvatarUrl?: string;
  gender?: string | null;
  avatarStyle?: string | null;
  onAvatarUpdated?: (newUrl: string | null) => void;
  size?: string;
  className?: string;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  currentAvatarUrl,
  gender,
  avatarStyle,
  onAvatarUpdated,
  size,
  className = '',
}) => {
  const { showToast, refreshData } = useApp();
  const currentUser = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine active avatar URL
  const effectiveAvatar = currentAvatarUrl !== undefined ? currentAvatarUrl : (currentUser?.avatar || '');
  const effectiveGender = gender !== undefined ? gender : (currentUser?.gender || '');
  const effectiveStyle = avatarStyle !== undefined ? avatarStyle : (currentUser?.avatarStyle || '');

  // Resolved fallback illustration
  const fallbackSvg = getDefaultAvatar(effectiveGender, effectiveStyle);
  const displayImage = previewUrl || effectiveAvatar || fallbackSvg;
  const isCustomUploaded = Boolean(effectiveAvatar && !effectiveAvatar.includes('.svg'));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5 MB limit)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is 5MB.`, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate MIME format
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Unsupported format. Please select a JPG, PNG, or WebP photo.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const res = await api.users.uploadAvatar(selectedFile);
      showToast('Profile photo updated successfully', 'success');
      if (onAvatarUpdated) {
        onAvatarUpdated(res.avatar_url);
      }
      await refreshData();
      handleCancelPreview();
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload profile photo', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsDeleting(true);
    try {
      await api.users.removeAvatar();
      showToast('Profile photo removed. Using faceless avatar.', 'info');
      if (onAvatarUpdated) {
        onAvatarUpdated(null);
      }
      await refreshData();
      handleCancelPreview();
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove photo', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-5 ${className}`}>
      {/* Circular Avatar Preview */}
      <div className="relative group">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shadow-sm flex items-center justify-center">
          <img
            src={displayImage}
            alt="Profile Avatar"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = fallbackSvg;
            }}
          />
        </div>

        {/* Quick upload click overlay */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
          aria-label="Upload profile image"
          className="absolute inset-0 bg-black/40 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] cursor-pointer"
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Change</span>
        </button>

        {previewUrl && (
          <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 text-white rounded-full shadow-md animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* Action Controls */}
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Profile Photo</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Upload a direct device image (JPG, PNG, or WebP up to 5MB). Automatically cropped to 512&times;512.
          </p>
        </div>

        {previewUrl ? (
          /* Staged Preview Actions */
          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
            <Button
              size="sm"
              variant="primary"
              onClick={handleApplyUpload}
              disabled={isUploading}
              icon={isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              className="text-xs px-3 min-h-[34px]"
            >
              {isUploading ? 'Saving...' : 'Apply Photo'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelPreview}
              disabled={isUploading}
              icon={<X className="w-3.5 h-3.5" />}
              className="text-xs px-2.5 min-h-[34px]"
            >
              Cancel
            </Button>
          </div>
        ) : (
          /* Default actions */
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isDeleting}
              icon={<Camera className="w-3.5 h-3.5" />}
              className="text-xs px-3 min-h-[34px]"
            >
              Upload Photo
            </Button>

            {isCustomUploaded && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={handleRemovePhoto}
                disabled={isUploading || isDeleting}
                icon={isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" /> : <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                className="text-xs px-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[34px]"
              >
                {isDeleting ? 'Removing...' : 'Remove'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
