import React, { ReactNode } from 'react';

interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  italicTitle?: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  eyebrow,
  title,
  italicTitle,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`text-center py-16 sm:py-20 px-6 sm:px-8 bg-[#FFFFFF] dark:bg-[#241D27] rounded-[4px] border border-[#DCD4CC] dark:border-[#392F3E] ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 mx-auto mb-4 rounded-[2px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center text-[#743C49] dark:text-[#D5A6A0]">
          {icon}
        </div>
      )}
      {eyebrow && (
        <span className="block text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-[#6D7068] dark:text-[#A89E9B] mb-2">
          {eyebrow}
        </span>
      )}
      <h3 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
        <span>{title}</span>
        {italicTitle && (
          <span className="italic font-serif font-normal text-[#743C49] dark:text-[#D5A6A0] ml-1.5">
            {italicTitle}
          </span>
        )}
      </h3>
      <p className="text-sm text-[#6D7068] dark:text-[#A89E9B] mt-2 max-w-md mx-auto font-sans leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6 flex items-center justify-center gap-3">{action}</div>}
    </div>
  );
};
