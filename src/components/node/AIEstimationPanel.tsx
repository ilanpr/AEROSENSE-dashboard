import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, ArrowRight, Activity, Percent } from "lucide-react";

export function AIEstimationPanel() {
  return (
    <Card className="h-full border-primary-200 bg-gradient-to-br from-white to-primary-50/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary-700">
          <Brain className="w-4 h-4" />
          AI Soft-Sensing Pipeline (PM2.5)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <div className="flex-1 w-full bg-white p-3 rounded-lg border border-border shadow-sm flex flex-col items-center text-center">
            <span className="text-xs text-muted-foreground mb-1">Raw Reading</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">18.5</span>
              <span className="text-[10px] text-muted-foreground">µg/m³</span>
            </div>
            <Activity className="w-3 h-3 text-muted-foreground mt-2" />
          </div>

          <ArrowRight className="w-5 h-5 text-primary-400 rotate-90 md:rotate-0 flex-shrink-0" />

          <div className="flex-1 w-full bg-primary-100 p-3 rounded-lg border border-primary-200 shadow-sm flex flex-col items-center text-center">
            <span className="text-xs text-primary-700 font-medium mb-1">Correction Factor</span>
            <div className="flex items-baseline gap-1 text-primary-700">
              <span className="text-xl font-bold">+1.2</span>
              <span className="text-[10px]">µg/m³</span>
            </div>
            <span className="text-[10px] text-primary-600 mt-2 bg-primary-200 px-2 py-0.5 rounded-full">
              Model: RF-v2.1
            </span>
          </div>

          <ArrowRight className="w-5 h-5 text-primary-400 rotate-90 md:rotate-0 flex-shrink-0" />

          <div className="flex-1 w-full bg-primary-600 text-white p-3 rounded-lg shadow-md flex flex-col items-center text-center">
            <span className="text-xs text-primary-100 mb-1">Estimated Output</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">19.7</span>
              <span className="text-[10px] text-primary-200">µg/m³</span>
            </div>
            <div className="flex items-center gap-1 mt-2 bg-primary-700 px-2 py-0.5 rounded-full">
              <Percent className="w-3 h-3 text-primary-200" />
              <span className="text-[10px] text-primary-100">Confidence: 94%</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Model AI memperhitungkan fluktuasi kelembapan (68%) yang dapat mendistorsi pembacaan
          sensor laser PM2.5.
        </p>
      </CardContent>
    </Card>
  );
}
