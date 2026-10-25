import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/constants'
import { SAMPLE_RECOMMENDATIONS } from '@/lib/mock-data'
import { ChevronRight } from 'lucide-react'

export function GreetingCard() {
  const navigate = useNavigate()
  const [recommendIndex, setRecommendIndex] = useState(0)

  const handleNextRecommendation = () => {
    setRecommendIndex((prev) => (prev + 1) % SAMPLE_RECOMMENDATIONS.length)
  }

  return (
    <article
      className="recommend-card p-5 relative select-none"
      aria-labelledby="recommendTitle"
    >
      <div className="relative z-10 max-w-[245px]">
        {/* Kicker */}
        <p className="flex items-center gap-1.5 text-[9px] font-black tracking-wider text-[#247fc9] uppercase mb-2.5">
          <span className="text-[#1189f4] text-sm leading-none">✦</span>
          SAPAAN HARI INI
          <span className="ml-auto text-[8px] tracking-normal text-[#75a9cb] bg-[#e5f4ff] rounded-full px-1.5 py-0.5 font-bold">
            CONTOH
          </span>
        </p>

        {/* Title */}
        <h2
          id="recommendTitle"
          className="text-base sm:text-lg font-black tracking-[-0.5px] text-[#17385b] leading-snug mb-2"
        >
          Satu langkah kecil untuk udara yang lebih baik.
        </h2>

        {/* Dynamic recommendation tip */}
        <p
          className="text-xs text-[#456780] font-medium leading-relaxed min-h-[58px] mb-3"
          aria-live="polite"
        >
          {SAMPLE_RECOMMENDATIONS[recommendIndex]}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={handleNextRecommendation}
            className="bg-[#0878f4] hover:bg-[#0069e4] text-white rounded-[9px] px-3 py-2 text-[10px] font-extrabold inline-flex items-center gap-1 shadow-[0_5px_12px_rgba(8,120,244,0.24)] transition-colors cursor-pointer"
          >
            Saran lain <ChevronRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.AEROBOT)}
            className="text-[#126fc5] hover:underline text-[10px] font-extrabold py-1 cursor-pointer"
          >
            Tanya AERO-BOT
          </button>
        </div>
      </div>

      {/* Mascot SVG image with gentle wave animation */}
      <img
        src="/assets/aerobot/falcon/welcome.webp"
        alt="AERO-BOT melambaikan tangan"
        className="recommend-mascot"
        width={136}
        height={140}
      />
    </article>
  )
}
