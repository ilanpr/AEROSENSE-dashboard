import React from 'react'

interface PageHeadingProps {
  eyebrow?: string
  title: string
  titleAccent?: string
  description?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}

export function PageHeading({
  eyebrow,
  title,
  titleAccent,
  description,
  badge,
  actions,
}: PageHeadingProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-[#6fa0ca] mb-2 flex items-center gap-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.6px] leading-[1.18] text-[#11223D]">
          {title} {titleAccent && <span className="text-[#086CFB]">{titleAccent}</span>}
        </h1>
        {description && (
          <p className="text-xs text-[#7A8CA4] mt-2 font-medium">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {badge}
        {actions}
      </div>
    </div>
  )
}
