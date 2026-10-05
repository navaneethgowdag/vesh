import React, { useState } from 'react';
import { Send, Heart } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Post } from '../../types';
import { useApp, useCurrentUser } from '../../context/AppContext';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  onClose,
  post,
}) => {
  const { addCommentToPost } = useApp();
  const currentUser = useCurrentUser();
  const [newComment, setNewComment] = useState('');

  if (!post) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentToPost(post.id, newComment);
    setNewComment('');
  };

  const comments = post.comments || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Discussion & Fit Inquiries"
      subtitle={`Comments on @${post.user.username}'s look`}
      maxWidth="md"
    >
      <div className="flex flex-col h-[460px]">
        {/* Caption Summary */}
        <div className="flex items-start gap-3 p-3 bg-sand-100 rounded-2xl mb-4 border border-sand-200">
          <Avatar src={post.user.avatar} alt={post.user.name} size="sm" isVerified={post.user.isVerified} />
          <div className="text-xs">
            <span className="font-bold text-charcoal-900 mr-1.5">@{post.user.username}</span>
            <span className="text-charcoal-700">{post.caption}</span>
          </div>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {comments.length === 0 ? (
            <div className="text-center py-12 text-charcoal-400 text-xs">
              No comments yet. Be the first to ask about pieces or styling tips!
            </div>
          ) : (
            comments.map((comm) => (
              <div key={comm.id} className="flex items-start gap-3 group">
                <Avatar src={comm.user.avatar} alt={comm.user.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-charcoal-900">
                      @{comm.user.username}
                    </span>
                    <span className="text-[10px] text-charcoal-400">{comm.createdAt}</span>
                  </div>
                  <p className="text-xs text-charcoal-700 mt-0.5 leading-relaxed">{comm.text}</p>
                </div>
                <button
                  className="opacity-40 group-hover:opacity-100 text-charcoal-400 hover:text-rose-500 p-1"
                  title="Like comment"
                >
                  <Heart className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        <form onSubmit={handleSubmit} className="pt-4 border-t border-sand-200/80 flex items-center gap-2">
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="xs" />
          <input
            type="text"
            placeholder="Add a comment or styling question..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 bg-sand-100 border border-sand-200 rounded-full px-4 py-2 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim()}
            className="rounded-full px-3.5 py-1.5"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </Modal>
  );
};

