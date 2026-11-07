import { APP_CONFIG } from "@/lib/constants";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 shadow-sm"></div>
      <span className="text-xl font-bold tracking-tight text-primary-700">{APP_CONFIG.name}</span>
    </div>
  );
}
