import React, { ReactNode } from 'react';

interface EditorialSectionHeaderProps {
  eyebrow?: string;
  title: string;
  italicTitle?: string;
  count?: number | string;
  action?: ReactNode;
  className?: string;
}

export const EditorialSectionHeader: React.FC<EditorialSectionHeaderProps> = ({
  eyebrow,
  title,
  italicTitle,
  count,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-baseline justify-between gap-4 mb-4 pb-2 border-b border-[#DCD4CC]/60 dark:border-[#392F3E]/60 ${className}`}>
      <div>
        {eyebrow && (
          <span className="block text-[10px] font-sans font-semibold uppercase tracking-[0.18em] text-[#6D7068] dark:text-[#A89E9B] mb-1">
            {eyebrow}
          </span>
        )}
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xl sm:text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
            <span>{title}</span>
            {italicTitle && (
              <span className="italic font-serif font-normal text-[#743C49] dark:text-[#D5A6A0] ml-1.5">
                {italicTitle}
              </span>
            )}
          </h2>
          {count !== undefined && (
            <span className="text-xs font-mono font-semibold text-[#6D7068] dark:text-[#A89E9B]">
              [{count}]
            </span>
          )}
        </div>
      </div>

      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};
