import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface SensorCardProps {
  label: string;
  value: string | number;
  unit: string;
  status: "normal" | "warning" | "critical" | "offline";
  trend: "up" | "down" | "stable";
}

export function SensorCard({ label, value, unit, status, trend }: SensorCardProps) {
  const statusColors = {
    normal: "text-green-500",
    warning: "text-yellow-500",
    critical: "text-red-500",
    offline: "text-slate-500",
  };
  const bgColors = {
    normal: "bg-green-500/10 border-green-500/20",
    warning: "bg-yellow-500/10 border-yellow-500/20",
    critical: "bg-red-500/10 border-red-500/20",
    offline: "bg-slate-500/10 border-slate-500/20",
  };

  return (
    <Card className={`overflow-hidden border transition-colors ${bgColors[status]}`}>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className={`${statusColors[status]}`}>
            {trend === "up" && <ArrowUp className="w-4 h-4" />}
            {trend === "down" && <ArrowDown className="w-4 h-4" />}
            {trend === "stable" && <Minus className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${statusColors[status]}`}>{value}</span>
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}
