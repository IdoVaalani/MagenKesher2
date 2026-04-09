import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_LOCATIONS = [
  "אצל החייל", "משקשייה", "רכב", "מחסן", "חדר נשק", "אחר"
];

const COLOR_PALETTE = [
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-blue-100 text-blue-800",
  "bg-amber-100 text-amber-800",
  "bg-red-100 text-red-800",
  "bg-slate-100 text-slate-800",
];

let cachedLocations = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

async function fetchLocations() {
  const now = Date.now();
  if (cachedLocations && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedLocations;
  }
  try {
    const settingsList = await base44.entities.AppSettings.list(null, 1);
    const settings = settingsList?.[0];
    if (settings?.equipment_locations && settings.equipment_locations.length > 0) {
      cachedLocations = settings.equipment_locations;
    } else {
      cachedLocations = DEFAULT_LOCATIONS;
    }
  } catch {
    cachedLocations = DEFAULT_LOCATIONS;
  }
  cacheTimestamp = now;
  return cachedLocations;
}

export function getLocationColor(location) {
  if (!cachedLocations) return "bg-slate-100 text-slate-800";
  const index = cachedLocations.indexOf(location);
  if (index >= 0) return COLOR_PALETTE[index % COLOR_PALETTE.length];
  return "bg-slate-100 text-slate-800";
}

export function useLocations() {
  const [locations, setLocations] = useState(cachedLocations || DEFAULT_LOCATIONS);
  useEffect(() => {
    fetchLocations().then(setLocations);
  }, []);
  return locations;
}

export function LocationSelectField({ value, onChange, details, onDetailsChange, size = "default" }) {
  const locations = useLocations();
  const isSmall = size === "sm";

  return (
    <div className={`flex items-center gap-2 ${isSmall ? '' : 'flex-col items-stretch'}`}>
      <div className={`flex items-center gap-2 ${isSmall ? '' : 'w-full'}`}>
        <MapPin className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} text-slate-400 shrink-0`} />
        <Select value={value || locations[0] || "אצל החייל"} onValueChange={onChange}>
          <SelectTrigger className={isSmall ? "h-7 text-xs min-w-[120px]" : "w-full"}>
            <SelectValue placeholder="בחר מיקום..." />
          </SelectTrigger>
          <SelectContent>
            {locations.map(loc => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {onDetailsChange && (
        <Input
          value={details || ""}
          onChange={(e) => onDetailsChange(e.target.value)}
          placeholder="פירוט נוסף..."
          className={isSmall ? "h-7 text-xs min-w-[100px]" : "w-full"}
        />
      )}
    </div>
  );
}

export { DEFAULT_LOCATIONS };