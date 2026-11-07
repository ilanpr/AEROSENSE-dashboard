export type FilterType = "semua" | "baik" | "perhatian";

interface NodeFilterProps {
  currentFilter: FilterType;
  onChange: (filter: FilterType) => void;
  counts: {
    semua: number;
    baik: number;
    perhatian: number;
  };
}

export function NodeFilter({ currentFilter, onChange, counts }: NodeFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div
        className="inline-flex bg-[#e7f1fb] border border-[#dcebf9] rounded-xl p-1 gap-1 max-w-full overflow-x-auto select-none"
        role="group"
        aria-label="Filter status sensor"
      >
        <button
          type="button"
          onClick={() => onChange("semua")}
          className={`border-0 text-[10px] font-extrabold px-3 py-2 rounded-[9px] whitespace-nowrap transition-all cursor-pointer ${
            currentFilter === "semua"
              ? "bg-white text-[#0872f2] shadow-[0_2px_7px_rgba(167,199,228,0.32)]"
              : "text-[#7b8da5] hover:text-[#0872f2]"
          }`}
        >
          Semua node <b className="text-[9px] ml-1 font-black opacity-80">{counts.semua}</b>
        </button>

        <button
          type="button"
          onClick={() => onChange("baik")}
          className={`border-0 text-[10px] font-extrabold px-3 py-2 rounded-[9px] whitespace-nowrap transition-all cursor-pointer ${
            currentFilter === "baik"
              ? "bg-white text-[#0872f2] shadow-[0_2px_7px_rgba(167,199,228,0.32)]"
              : "text-[#7b8da5] hover:text-[#0872f2]"
          }`}
        >
          Baik <b className="text-[9px] ml-1 font-black opacity-80">{counts.baik}</b>
        </button>

        <button
          type="button"
          onClick={() => onChange("perhatian")}
          className={`border-0 text-[10px] font-extrabold px-3 py-2 rounded-[9px] whitespace-nowrap transition-all cursor-pointer ${
            currentFilter === "perhatian"
              ? "bg-white text-[#0872f2] shadow-[0_2px_7px_rgba(167,199,228,0.32)]"
              : "text-[#7b8da5] hover:text-[#0872f2]"
          }`}
        >
          Perlu perhatian{" "}
          <b className="text-[9px] ml-1 font-black opacity-80">{counts.perhatian}</b>
        </button>
      </div>

      <div className="text-[10px] text-[#8194a9] font-medium whitespace-nowrap flex items-center gap-2">
        <span className="w-2 h-2 shrink-0 rounded-full bg-[#35c796] shadow-[0_0_0_3px_#e0f9ed]" />
        Data simulasi • 09.41 WIB
      </div>
    </div>
  );
}
