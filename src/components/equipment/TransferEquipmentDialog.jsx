import React, { useState } from "react";
import { Equipment } from "@/entities/Equipment";
import { Soldier } from "@/entities/Soldier";
import { SystemLog } from "@/entities/SystemLog";
import { useCompany } from "@/components/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightLeft, Loader2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TransferEquipmentDialog({ open, onOpenChange, equipment, onTransferComplete }) {
  const { currentCompany } = useCompany();
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [pauseConfirmations, setPauseConfirmations] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open && currentCompany) {
      loadSoldiers();
      setNewLocation(equipment?.location || "");
      setPauseConfirmations(false);
      setSelectedSoldier(null);
      setSearchTerm("");
    }
  }, [open, currentCompany]);

  const loadSoldiers = async () => {
    setLoading(true);
    try {
      const allSoldiers = await Soldier.filter({ company_id: currentCompany.id });
      setSoldiers(allSoldiers);
    } catch (error) {
      console.error("Error loading soldiers:", error);
    }
    setLoading(false);
  };

  const storageOption = { 
    id: 'STORAGE', 
    full_name: '🏢 משקשייה (חדר נשק)', 
    personal_id: '', 
    email: '' 
  };
  
  const allSoldierOptions = [storageOption, ...soldiers];
  
  const filteredSoldiers = allSoldierOptions.filter(soldier =>
    soldier.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    soldier.personal_id?.includes(searchTerm)
  );

  const handleTransfer = async () => {
    if (!selectedSoldier) {
      alert("בחר חייל");
      return;
    }

    setIsTransferring(true);
    try {
      const updateData = {
        soldier_name: selectedSoldier.full_name,
        soldier_email: selectedSoldier.email || equipment.soldier_email,
        soldier_id: selectedSoldier.personal_id || equipment.soldier_id,
        location: newLocation || equipment.location,
        requires_soldier_confirmation: !pauseConfirmations,
      };

      await Equipment.update(equipment.id, updateData);

      await SystemLog.create({
        company_id: currentCompany.id,
        message: `ציוד הועבר מ-${equipment.soldier_name} ל-${selectedSoldier.full_name}${pauseConfirmations ? ' (אישורים יומיים מושהים)' : ''}`,
        level: 'info',
        category: 'data'
      });

      onTransferComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error transferring equipment:", error);
      alert("שגיאה בהעברת הציוד");
    }
    setIsTransferring(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            העבר ציוד לחייל אחר
          </DialogTitle>
          <DialogDescription>
            העבר את הציוד מ-<strong>{equipment?.soldier_name}</strong> לחייל אחר
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>חפש חייל</Label>
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="חפש לפי שם או מספר אישי..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>בחר חייל יעד</Label>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              </div>
            ) : (
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredSoldiers.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">לא נמצאו חיילים</p>
                  ) : (
                    filteredSoldiers.map(soldier => (
                      <button
                        key={soldier.id}
                        onClick={() => setSelectedSoldier(soldier)}
                        className={`w-full text-right p-3 rounded-lg transition-colors ${
                          selectedSoldier?.id === soldier.id
                            ? 'bg-blue-100 border-2 border-blue-500'
                            : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="font-semibold">{soldier.full_name}</div>
                        {soldier.personal_id && (
                          <div className="text-sm text-slate-500">{soldier.personal_id}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-2">
            <Label>מיקום חדש (אופציונלי)</Label>
            <Input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="לדוגמה: מחסן, חדר נשק..."
            />
          </div>

          <div className="flex items-center space-x-2 space-x-reverse bg-amber-50 p-3 rounded-lg border border-amber-200">
            <Checkbox
              id="pause-confirmations"
              checked={pauseConfirmations}
              onCheckedChange={setPauseConfirmations}
            />
            <label
              htmlFor="pause-confirmations"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              השהה אישורים יומיים זמנית (הציוד במעבר)
            </label>
          </div>

          {pauseConfirmations && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                💡 הציוד לא יידרש לאישור יומי עד שתפעיל מחדש את האישורים בעריכת הציוד
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isTransferring}>
            ביטול
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedSoldier || isTransferring}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTransferring ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מעביר...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 ml-2" />
                העבר ציוד
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}