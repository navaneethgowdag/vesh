import React, { useState } from 'react';
import { Copy, Check, Share2, Twitter } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Post } from '../../types';
import { useApp } from '../../context/AppContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useApp();

  if (!post) return null;

  const shareUrl = `${window.location.origin}/home?post=${post.id}`;
  const shareText = `Check out @${post.user.username}'s fit on StyleSphere: "${post.caption}"`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copied URL', 'success');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `StyleSphere Outfit by @${post.user.username}`,
          text: shareText,
          url: shareUrl,
        });
        showToast('Shared successfully!', 'success');
        onClose();
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Outfit"
      subtitle="Inspire friends or save to your external boards"
      maxWidth="sm"
    >
      <div className="space-y-5">
        {/* Post Preview Miniature */}
        <div className="flex items-center gap-3.5 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
          <img
            src={post.image}
            alt="Outfit preview"
            className="w-14 h-14 rounded object-cover shadow-sm flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              Fit by @{post.user.username}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
              {post.caption}
            </p>
          </div>
        </div>

        {/* URL Input with Copy Button */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
            Post Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-base sm:text-xs text-zinc-900 dark:text-zinc-100 select-all focus:outline-none"
            />
            <Button
              size="sm"
              variant={copied ? 'secondary' : 'primary'}
              onClick={handleCopy}
              className="flex-shrink-0 min-h-[44px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleNativeShare}
            className="w-full text-xs min-h-[44px]"
            icon={<Share2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />}
          >
            System Share
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={shareToTwitter}
            className="w-full text-xs min-h-[44px]"
            icon={<Twitter className="w-4 h-4 text-sky-500" />}
          >
            Share on X
          </Button>
        </div>
      </div>
    </Modal>
  );
};
