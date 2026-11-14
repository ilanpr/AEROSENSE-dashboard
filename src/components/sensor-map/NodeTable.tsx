import { type PrototypeNodeInfo } from "@/lib/mock-data";

interface NodeTableProps {
  nodes: PrototypeNodeInfo[];
  selectedNodeName: string;
  onSelectNode: (name: string) => void;
}

export function NodeTable({ nodes, selectedNodeName, onSelectNode }: NodeTableProps) {
  return (
    <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm p-5 mt-5">
      <div className="flex justify-between items-center gap-4 mb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[1.6px] text-[#6fa0ca] mb-1">
            SELURUH JARINGAN
          </p>
          <h2 className="text-base font-black text-[#11223D]">Daftar node</h2>
        </div>
        <span className="text-[10px] text-[#8d9db1] font-bold">
          {nodes.length} node ditampilkan
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse text-left">
          <thead>
            <tr className="bg-[#f9fcff]">
              <th className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#9aabba] py-3 px-3.5 border-b border-[#ecf1f7] rounded-l-lg">
                Lokasi
              </th>
              <th className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#9aabba] py-3 px-3.5 border-b border-[#ecf1f7]">
                Kode node
              </th>
              <th className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#9aabba] py-3 px-3.5 border-b border-[#ecf1f7]">
                AQI
              </th>
              <th className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#9aabba] py-3 px-3.5 border-b border-[#ecf1f7]">
                PM2.5
              </th>
              <th className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#9aabba] py-3 px-3.5 border-b border-[#ecf1f7]">
                Status
              </th>
              <th className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#9aabba] py-3 px-3.5 border-b border-[#ecf1f7] rounded-r-lg">
                Pembaruan
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {nodes.map((node) => {
              const isSelected = node.name === selectedNodeName;
              const isGood = node.uiStatus === "baik";

              return (
                <tr
                  key={node.code}
                  className={`transition-colors ${
                    isSelected ? "bg-[#f0f7ff]" : "hover:bg-[#fafcff]"
                  }`}
                >
                  <td className="py-3.5 px-3.5 text-xs">
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.name)}
                      className="font-extrabold text-[#1677ec] hover:underline cursor-pointer text-left"
                    >
                      {node.name}
                    </button>
                  </td>
                  <td className="py-3.5 px-3.5 text-xs text-[#526783] font-medium">{node.code}</td>
                  <td className="py-3.5 px-3.5 text-xs">
                    <strong className="text-[#1e3554] font-black">{node.aqi}</strong>
                  </td>
                  <td className="py-3.5 px-3.5 text-xs text-[#526783] font-medium">
                    {node.pm25.toString().replace(".", ",")} µg/m³
                  </td>
                  <td className="py-3.5 px-3.5 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[9.5px] font-extrabold ${
                        isGood ? "bg-[#e9f9f1] text-[#1ca779]" : "bg-[#fff1e7] text-[#d77b36]"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {isGood ? "Baik" : "Perlu perhatian"}
                    </span>
                  </td>
                  <td className="py-3.5 px-3.5 text-xs text-[#6e829d]">{node.lastUpdate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
