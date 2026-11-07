import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, Clock, ActivitySquare, Server } from "lucide-react";

export function NodeHealthCard() {
  return (
    <Card className="h-full border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
          <ActivitySquare className="w-4 h-4 text-muted-foreground" />
          Kesehatan Sistem
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Wifi className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status MQTT</p>
            <p className="text-sm font-semibold text-foreground">Terhubung</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Clock className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Uptime</p>
            <p className="text-sm font-semibold text-foreground">99.8%</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-secondary rounded-lg">
            <Server className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latensi</p>
            <p className="text-sm font-semibold text-foreground">42 ms</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <ActivitySquare className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pembaruan</p>
            <p className="text-sm font-semibold text-foreground">3 detik lalu</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
