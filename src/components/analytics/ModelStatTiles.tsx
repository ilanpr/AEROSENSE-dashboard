import { Sparkles, LineChart, Wind, Check } from "lucide-react";

export function ModelStatTiles() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm min-h-[132px] p-4 sm:p-4.5 flex flex-col justify-between">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-[#e6f1ff] text-[#0d77f4] grid place-items-center mb-2.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[10px] text-[#899aaf] font-bold">Kepercayaan estimasi</span>
          <strong className="block text-2xl font-black text-[#11223D] tracking-[-0.8px] mt-1 leading-tight">
            94,8%
          </strong>
          <small className="block text-[9.5px] text-[#a4b1c0] font-medium mt-1">
            Rata-rata data contoh
          </small>
        </div>
      </article>

      <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm min-h-[132px] p-4 sm:p-4.5 flex flex-col justify-between">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-[#e1f7ff] text-[#00a0c5] grid place-items-center mb-2.5">
          <LineChart className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[10px] text-[#899aaf] font-bold">MAE model</span>
          <strong className="block text-2xl font-black text-[#11223D] tracking-[-0.8px] mt-1 leading-tight">
            3,2 <small className="text-[10px] text-[#8396aa] font-bold">µg/m³</small>
          </strong>
          <small className="block text-[9.5px] text-[#a4b1c0] font-medium mt-1">
            Galat rata-rata absolut
          </small>
        </div>
      </article>

      <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm min-h-[132px] p-4 sm:p-4.5 flex flex-col justify-between">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-[#efedff] text-[#756be9] grid place-items-center mb-2.5">
          <Wind className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[10px] text-[#899aaf] font-bold">RMSE model</span>
          <strong className="block text-2xl font-black text-[#11223D] tracking-[-0.8px] mt-1 leading-tight">
            4,6 <small className="text-[10px] text-[#8396aa] font-bold">µg/m³</small>
          </strong>
          <small className="block text-[9.5px] text-[#a4b1c0] font-medium mt-1">
            Galat dengan bobot lonjakan
          </small>
        </div>
      </article>

      <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm min-h-[132px] p-4 sm:p-4.5 flex flex-col justify-between">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-[#e5faed] text-[#17b784] grid place-items-center mb-2.5">
          <Check className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div>
          <span className="block text-[10px] text-[#899aaf] font-bold">Data tervalidasi</span>
          <strong className="block text-2xl font-black text-[#11223D] tracking-[-0.8px] mt-1 leading-tight">
            98,1%
          </strong>
          <small className="block text-[9.5px] text-[#a4b1c0] font-medium mt-1">
            Dalam sampel pemantauan
          </small>
        </div>
      </article>
    </div>
  );
}
