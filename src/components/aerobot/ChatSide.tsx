import { AeroMascot } from "@/components/environment/AeroMascot";
import { Radio, CloudSun, Newspaper } from "lucide-react";

const sources = [
  {icon: Radio, title: "Sensor AEROSENSE", detail: "Pembacaan node yang Anda pilih."},
  {icon: CloudSun, title: "Data lingkungan", detail: "Cuaca, udara, tanah, dan sungai di titik robot."},
  {icon: Newspaper, title: "Bencana Indonesia", detail: "Berita dan pantauan dari sumber publik."},
];

export function ChatSide() {
  return <section className="chat-source-panel rounded-2xl border border-[#dce8f5] bg-white p-5 sm:p-6">
    <AeroMascot pose="watch" className="chat-mascot" />
    <h2 className="text-sm font-semibold text-[#25405f] mb-5">Sumber jawaban</h2>
    <dl className="space-y-5">
      {sources.map(s => <div key={s.title} className="flex gap-3">
        <s.icon size={18} className="text-[#2875c4] shrink-0 mt-0.5" aria-hidden="true" />
        <div><dt className="text-sm font-medium text-[#25405f]">{s.title}</dt><dd className="text-xs text-[#56708a] mt-1 leading-relaxed">{s.detail}</dd></div>
      </div>)}
    </dl>
  </section>;
}
