// Public AEROSENSE Business contact. Override for another deployment at build time.
export const WHATSAPP_NUMBER = import.meta.env?.VITE_WHATSAPP_NUMBER?.trim() || "6281994695227";
export function whatsAppUrl(message = "Mulai", phone = WHATSAPP_NUMBER): string | null {
  const number = phone.replace(/^\+/, "");
  if (!/^\d{8,15}$/.test(number) || !message.trim() || message.length > 2000) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
