import React, { ReactNode } from 'react';

interface EditorialPageHeaderProps {
  eyebrow?: string;
  title: string;
  italicTitle?: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export const EditorialPageHeader: React.FC<EditorialPageHeaderProps> = ({
  eyebrow,
  title,
  italicTitle,
  description,
  actions,
  meta,
  className = '',
}) => {
  return (
    <div className={`mb-8 sm:mb-10 pb-6 border-b border-[#DCD4CC] dark:border-[#392F3E] ${className}`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="max-w-2xl">
          {eyebrow && (
            <span className="block text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-[#743C49] dark:text-[#D5A6A0] mb-2 select-none">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-[1.08]">
            <span>{title}</span>
            {italicTitle && (
              <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0] ml-2">
                {italicTitle}
              </span>
            )}
          </h1>
          {description && (
            <p className="mt-2 text-sm sm:text-base text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
              {description}
            </p>
          )}
          {meta && <div className="mt-3 flex items-center gap-3">{meta}</div>}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
