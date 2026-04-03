import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

const LOCATION_OPTIONS = [
  { value: "אצל החייל", label: "אצל החייל", color: "bg-green-100 text-green-800" },
  { value: "משקשייה", label: "משקשייה", color: "bg-purple-100 text-purple-800" },
  { value: "רכב", label: "רכב", color: "bg-blue-100 text-blue-800" },
  { value: "מחסן", label: "מחסן", color: "bg-amber-100 text-amber-800" },
  { value: "חדר נשק", label: "חדר נשק", color: "bg-red-100 text-red-800" },
  { value: "אחר", label: "אחר", color: "bg-slate-100 text-slate-800" },
];

export function getLocationColor(location) {
  const option = LOCATION_OPTIONS.find(o => o.value === location);
  return option ? option.color : "bg-slate-100 text-slate-800";
}

export function LocationSelectField({ value, onChange, details, onDetailsChange, size = "default" }) {
  const isSmall = size === "sm";
  const showDetails = value === "רכב" || value === "מחסן" || value === "אחר";

  return (
    <div className={`flex items-center gap-2 ${isSmall ? '' : 'flex-col items-stretch'}`}>
      <div className={`flex items-center gap-2 ${isSmall ? '' : 'w-full'}`}>
        <MapPin className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} text-slate-400 shrink-0`} />
        <Select value={value || "אצל החייל"} onValueChange={onChange}>
          <SelectTrigger className={isSmall ? "h-7 text-xs min-w-[120px]" : "w-full"}>
            <SelectValue placeholder="בחר מיקום..." />
          </SelectTrigger>
          <SelectContent>
            {LOCATION_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showDetails && onDetailsChange && (
        <Input
          value={details || ""}
          onChange={(e) => onDetailsChange(e.target.value)}
          placeholder={value === "רכב" ? "מספר רכב..." : value === "מחסן" ? "שם מחסן..." : "פירוט..."}
          className={isSmall ? "h-7 text-xs min-w-[100px]" : "w-full"}
        />
      )}
    </div>
  );
}

export { LOCATION_OPTIONS };