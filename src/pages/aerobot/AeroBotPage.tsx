import { PageHeading } from "@/components/shared/PageHeading";
import { ChatPanel } from "@/components/aerobot/ChatPanel";
import { ChatSide } from "@/components/aerobot/ChatSide";
import { WhatsAppEntry } from "@/components/live/WhatsAppEntry";
import { useAuth } from "@/hooks/useAuth";
export function AeroBotPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-5">
      <PageHeading title="Tanya AERO-BOT" actions={user && <WhatsAppEntry />} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)] gap-5 items-start">
        <ChatPanel />
        <aside>
          <ChatSide />
        </aside>
      </div>
    </div>
  );
}
