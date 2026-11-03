import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, BarChart2, AlertCircle, RefreshCw } from 'lucide-react';
import { Poll } from '../../types';
import { api } from '../../services/api';
import { useCurrentUser } from '../../context/AppContext';

interface PollWidgetProps {
  poll: Poll;
  onVoteSuccess?: (updatedPoll: Poll) => void;
  compact?: boolean;
}

export const PollWidget: React.FC<PollWidgetProps> = ({
  poll: initialPoll,
  onVoteSuccess,
  compact = false,
}) => {
  const [poll, setPoll] = useState<Poll>(initialPoll);
  const [isVoting, setIsVoting] = useState(false);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChangingVote, setIsChangingVote] = useState(false);

  const currentUser = useCurrentUser();
  const isCreator = currentUser?.id === poll.creator_user_id;

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return 'Closed';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const handleVote = async (optionId: string) => {
    if (poll.is_expired) {
      setErrorMessage('This poll has closed');
      return;
    }

    if (isCreator && !poll.allow_creator_vote) {
      setErrorMessage('Creators cannot vote on their own poll to prevent bias');
      return;
    }

    if (poll.has_voted && !poll.allow_vote_change) {
      setErrorMessage('Vote changing is not allowed for this poll');
      return;
    }

    setIsVoting(true);
    setVotingOptionId(optionId);
    setErrorMessage(null);

    try {
      const updated = await api.polls.vote(poll.id, optionId);
      setPoll(updated);
      setIsChangingVote(false);
      onVoteSuccess?.(updated);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit vote');
    } finally {
      setIsVoting(false);
      setVotingOptionId(null);
    }
  };

  // Determine if vote results should be displayed
  const showResults =
    (poll.has_voted && !isChangingVote) ||
    poll.is_expired ||
    poll.show_results_before_vote ||
    (isCreator && !isChangingVote);

  return (
    <div
      className={`rounded-lg border transition-all ${
        compact
          ? 'bg-black/60 backdrop-blur-md border-white/20 text-white p-3.5 space-y-3'
          : 'bg-zinc-50 dark:bg-zinc-950/80 border-zinc-200 dark:border-zinc-800 p-4 space-y-3.5'
      }`}
    >
      {/* Poll Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Community Poll</span>
          </div>
          <h4
            className={`font-semibold leading-snug ${
              compact
                ? 'text-sm text-white'
                : 'text-sm sm:text-base text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {poll.question}
          </h4>
        </div>

        {/* Status / Expiration Badge */}
        <div className="flex-shrink-0">
          {poll.is_expired ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              <Clock className="w-3 h-3" />
              {formatRemainingTime(poll.time_remaining_seconds)}
            </span>
          )}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 p-2 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Creator notice if creator cannot vote */}
      {isCreator && !poll.allow_creator_vote && !poll.has_voted && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
          Creator voting is disabled to ensure unbiased feedback.
        </p>
      )}

      {/* Options List */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = poll.user_voted_option_id === option.id;
          const percentage = option.percentage ?? 0;
          const voteCount = option.vote_count ?? 0;

          if (showResults) {
            return (
              <div
                key={option.id}
                onClick={() => {
                  if (poll.allow_vote_change && !poll.is_expired && (!isCreator || poll.allow_creator_vote)) {
                    handleVote(option.id);
                  }
                }}
                className={`relative overflow-hidden rounded-md border p-2.5 transition-all ${
                  poll.allow_vote_change && !poll.is_expired && (!isCreator || poll.allow_creator_vote)
                    ? 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600'
                    : 'cursor-default'
                } ${
                  isSelected
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/60 dark:bg-zinc-900/60'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                }`}
              >
                {/* Visual percentage progress fill */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`absolute inset-y-0 left-0 opacity-20 pointer-events-none ${
                    isSelected
                      ? 'bg-zinc-900 dark:bg-zinc-100'
                      : 'bg-zinc-400 dark:bg-zinc-600'
                  }`}
                />

                <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 pr-2 font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{option.option_text}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 font-semibold text-zinc-700 dark:text-zinc-300">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                      ({voteCount})
                    </span>
                    <span>{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          }

          // Unvoted state: clickable buttons
          const isThisVoting = isVoting && votingOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isVoting || poll.is_expired || (isCreator && !poll.allow_creator_vote)}
              onClick={() => handleVote(option.id)}
              className={`w-full flex items-center justify-between text-left p-2.5 rounded-md text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                compact
                  ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white disabled:opacity-50'
                  : 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 disabled:opacity-50'
              }`}
            >
              <span className="truncate">{option.option_text}</span>
              {isThisVoting && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>
          {poll.total_votes != null
            ? `${poll.total_votes} ${poll.total_votes === 1 ? 'vote' : 'votes'}`
            : 'Vote to see results'}
        </span>

        {poll.has_voted && poll.allow_vote_change && !poll.is_expired && (
          <button
            type="button"
            onClick={() => setIsChangingVote(!isChangingVote)}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline"
          >
            {isChangingVote ? 'Cancel' : 'Change vote'}
          </button>
        )}
      </div>
    </div>
  );
};
