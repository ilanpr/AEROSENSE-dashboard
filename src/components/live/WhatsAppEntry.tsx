import { useRef, useState } from "react";
import { ArrowUpRight, MessageCircle, Send, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AeroMascot } from "@/components/environment/AeroMascot";
import { whatsAppUrl } from "@/lib/whatsapp";
import { DEMO_MODE } from "@/lib/demo-mode";
import "@/styles/whatsapp.css";

export function WhatsAppEntry({ command = "Mulai", label = "Chat lewat WhatsApp" }: { command?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const primary = useRef<HTMLAnchorElement>(null);
  const url = whatsAppUrl(command);
  const pairing = command.startsWith("DAFTAR ");
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button className="wa-entry-button" disabled={!url} title={url ? undefined : "Nomor WhatsApp belum tersedia"}>
        <MessageCircle size={19} aria-hidden="true" />{label}<ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </DialogTrigger>
    <DialogContent className="wa-start-dialog" showCloseButton={false}
      onOpenAutoFocus={event => { event.preventDefault(); primary.current?.focus(); }}>
      <DialogClose className="wa-start-close" aria-label="Tutup panduan WhatsApp"><X size={20} aria-hidden="true" /></DialogClose>
      <div className="wa-start-intro">
        <AeroMascot pose="calm" className="wa-start-mascot" />
        <DialogTitle className="wa-start-title">{pairing ? "Hubungkan notifikasi Anda." : "AERO-BOT, di WhatsApp."}</DialogTitle>
        <DialogDescription className="wa-start-description">
          {pairing ? "Kode sudah terisi. Tekan Kirim di WhatsApp untuk menghubungkan node pilihan Anda." : "Pesan awal sudah terisi. Tekan Kirim di WhatsApp, lalu pilih dari menu yang muncul."}
        </DialogDescription>
      </div>
      <div className="wa-start-preview" aria-label="Pratinjau pesan yang akan Anda kirim">
        <span>Pesan Anda</span><p>{command}<Send size={17} aria-hidden="true" /></p>
      </div>
      {url && <a ref={primary} className="wa-start-primary" href={url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
        Buka WhatsApp<ArrowUpRight size={20} aria-hidden="true" />
      </a>}
      <p className="wa-start-note">{pairing ? "Anda menyetujui notifikasi node ini. Ketik BERHENTI untuk berhenti." : DEMO_MODE ? "Lanjutkan percakapan melalui WhatsApp. Data sensor pada tampilan ini merupakan simulasi." : "Notifikasi sensor diaktifkan terpisah, setelah Anda memilih node."}</p>
    </DialogContent>
  </Dialog>;
}
