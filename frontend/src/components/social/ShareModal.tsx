import React, { useState, useEffect } from 'react';
import { Copy, Check, Share2, Twitter, MessageSquare, Users, Send } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Post, Conversation, Community } from '../../types';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: Post | null;
  contentType?: 'post' | 'poll' | 'community';
  contentId?: string;
  titleOrCaption?: string;
  imageUrl?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  post,
  contentType = 'post',
  contentId,
  titleOrCaption,
  imageUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'inside' | 'outside'>('inside');
  const [copied, setCopied] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
  const [shareNote, setShareNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [shareDestination, setShareDestination] = useState<'chat' | 'community'>('chat');
  const { showToast } = useApp();

  const effectiveId = contentId || post?.id || '';
  const effectiveType = post ? 'post' : contentType;
  const effectiveCaption = titleOrCaption || post?.caption || 'Check out this style on TailorBird';
  const effectiveImage = imageUrl || post?.image || '';

  const shareUrl = `${window.location.origin}/home?post=${effectiveId}`;
  const shareText = `Check out this style inspiration on TailorBird: "${effectiveCaption}"`;

  // Fetch conversations and communities when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const loadTargets = async () => {
      try {
        const [convs, comms] = await Promise.all([
          api.messages.listConversations().catch(() => []),
          api.communities.list().catch(() => []),
        ]);
        if (mounted) {
          setConversations(convs);
          if (convs.length > 0) {
            setSelectedConversationId(convs[0].id);
          }
          setCommunities(comms);
          if (comms.length > 0) {
            setSelectedCommunityId(comms[0].id);
          }
        }
      } catch {
        // targets will remain empty
      }
    };

    loadTargets();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
          title: `TailorBird Style Inspiration`,
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

  const shareToWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      `${shareText} ${shareUrl}`
    )}`;
    window.open(url, '_blank');
  };

  const handleSendInside = async () => {
    if (!effectiveId) return;

    setIsSending(true);
    try {
      if (shareDestination === 'chat') {
        if (!selectedConversationId) {
          showToast('Please select a conversation to send to', 'error');
          setIsSending(false);
          return;
        }
        await api.messages.share({
          target_type: 'conversation',
          target_id: selectedConversationId,
          content_type: effectiveType as 'post' | 'poll' | 'community',
          content_id: effectiveId,
          message: shareNote.trim() || undefined,
        });
        showToast('Sent in chat!', 'success');
      } else {
        if (!selectedCommunityId) {
          showToast('Please select a community to share to', 'error');
          setIsSending(false);
          return;
        }
        await api.messages.share({
          target_type: 'community',
          target_id: selectedCommunityId,
          content_type: effectiveType as 'post' | 'poll' | 'community',
          content_id: effectiveId,
          message: shareNote.trim() || undefined,
        });
        showToast('Shared to community feed!', 'success');
      }
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Failed to share content', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Style Inspiration"
      subtitle="Send directly to friends or share with fashion communities"
      maxWidth="sm"
    >
      <div className="space-y-4">
        {/* Post Preview Miniature */}
        <div className="flex items-center gap-3.5 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
          {effectiveImage ? (
            <img
              src={effectiveImage}
              alt="Preview"
              className="w-14 h-14 rounded object-cover shadow-sm flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-6 h-6 text-zinc-400" />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {effectiveType.toUpperCase()} PREVIEW
            </span>
            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 mt-0.5">
              {effectiveCaption}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('inside')}
            className={`flex-1 pb-2 text-xs font-bold transition-all relative ${
              activeTab === 'inside'
                ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
            }`}
          >
            Inside TailorBird
          </button>
          <button
            onClick={() => setActiveTab('outside')}
            className={`flex-1 pb-2 text-xs font-bold transition-all relative ${
              activeTab === 'outside'
                ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
            }`}
          >
            External Share
          </button>
        </div>

        {activeTab === 'inside' ? (
          <div className="space-y-3.5 pt-1">
            <div className="flex gap-2">
              <button
                onClick={() => setShareDestination('chat')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                  shareDestination === 'chat'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-semibold'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send in Chat
              </button>
              <button
                onClick={() => setShareDestination('community')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                  shareDestination === 'community'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-semibold'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Share to Community
              </button>
            </div>

            {shareDestination === 'chat' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Select Conversation
                </label>
                {conversations.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic py-2">
                    No active conversations yet. Visit Messages to start a chat.
                  </p>
                ) : (
                  <select
                    value={selectedConversationId}
                    onChange={(e) => setSelectedConversationId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    {conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || (c.other_participant ? c.other_participant.name : 'Direct Chat')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Select Community
                </label>
                {communities.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic py-2">
                    No communities found. Explore communities to join one!
                  </p>
                ) : (
                  <select
                    value={selectedCommunityId}
                    onChange={(e) => setSelectedCommunityId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Add an optional message
              </label>
              <input
                type="text"
                placeholder="Check out this style..."
                value={shareNote}
                onChange={(e) => setShareNote(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleSendInside}
              disabled={isSending}
              className="w-full text-xs min-h-[40px] mt-2"
              icon={<Send className="w-3.5 h-3.5" />}
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* URL Input with Copy Button */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 select-all focus:outline-none"
                />
                <Button
                  size="sm"
                  variant={copied ? 'secondary' : 'primary'}
                  onClick={handleCopy}
                  className="flex-shrink-0 min-h-[38px]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNativeShare}
                className="w-full text-xs min-h-[40px]"
                icon={<Share2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />}
              >
                System
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={shareToWhatsApp}
                className="w-full text-xs min-h-[40px]"
                icon={<span className="text-emerald-500 font-bold text-xs">WA</span>}
              >
                WhatsApp
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={shareToTwitter}
                className="w-full text-xs min-h-[40px]"
                icon={<Twitter className="w-3.5 h-3.5 text-sky-500" />}
              >
                X / Twitter
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
