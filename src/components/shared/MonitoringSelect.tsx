import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MonitoringSelect({ value, onValueChange, options, label, disabled = false, onPreviewChange }: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
  onPreviewChange?: (value: string | null) => void;
}) {
  return <Select value={value} onValueChange={onValueChange} disabled={disabled}
    onOpenChange={open => onPreviewChange?.(open ? value : null)}>
    <SelectTrigger aria-label={label} className="monitoring-select"><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent position="popper" align="start" className="monitoring-options">
      {options.map(option => <SelectItem key={option.value} value={option.value}
        onFocus={() => onPreviewChange?.(option.value)}
        onPointerMove={event => { if (event.pointerType === "mouse") onPreviewChange?.(option.value); }}
      >{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
