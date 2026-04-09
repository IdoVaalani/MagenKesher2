import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, MapPin } from "lucide-react";

const DEFAULT_LOCATIONS = ["אצל החייל", "משקשייה", "רכב", "מחסן", "חדר נשק", "אחר"];

export default function LocationsManager({ locations, onChange }) {
  const [newLocation, setNewLocation] = useState("");

  const currentLocations = locations && locations.length > 0 ? locations : DEFAULT_LOCATIONS;

  const handleAdd = () => {
    const trimmed = newLocation.trim();
    if (!trimmed) return;
    if (currentLocations.includes(trimmed)) {
      alert("מיקום זה כבר קיים ברשימה.");
      return;
    }
    onChange([...currentLocations, trimmed]);
    setNewLocation("");
  };

  const handleRemove = (index) => {
    if (currentLocations.length <= 1) {
      alert("חייב להישאר לפחות מיקום אחד.");
      return;
    }
    const updated = currentLocations.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {currentLocations.map((loc, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-slate-700">{loc}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="h-7 w-7 text-red-500 hover:bg-red-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="הקלד מיקום חדש..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!newLocation.trim()}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 ml-1" />
          הוסף
        </Button>
      </div>
    </div>
  );
}

export { DEFAULT_LOCATIONS };