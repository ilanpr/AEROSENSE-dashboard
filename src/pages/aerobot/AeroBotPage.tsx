import { PageHeading } from "@/components/shared/PageHeading";
import { ChatPanel } from "@/components/aerobot/ChatPanel";
import { ChatSide } from "@/components/aerobot/ChatSide";
import { RobotControls } from "@/components/aerobot/RobotControls";
export function AeroBotPage() {
  return (
    <div className="space-y-5">
      <PageHeading
        title="Tanya AERO-BOT"
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)] gap-5 items-start">
        <ChatPanel />
        <aside className="space-y-5">
          <ChatSide />
          <RobotControls />
        </aside>
      </div>
    </div>
  );
}
