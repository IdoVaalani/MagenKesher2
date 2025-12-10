import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserCheck, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Equipment } from "@/entities/Equipment";
import { DailyConfirmation } from "@/entities/DailyConfirmation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ManualConfirmationDialog({ open, onOpenChange, onConfirmationAdded }) {
  const [pendingSoldiers, setPendingSoldiers] = useState([]);
  const [selectedSoldiers, setSelectedSoldiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const { toast } = useToast();

  const fetchPendingSoldiers = async () => {
    setLoading(true);
    try {
      const [allEquipment, todayConfirmations] = await Promise.all([
        Equipment.filter({ requires_soldier_confirmation: true, status: 'active' }),
        DailyConfirmation.filter({ confirmation_date: new Date().toISOString().split('T')[0] }),
      ]);
      
      const soldiersRequiringConfirmation = [...new Set(allEquipment.map(eq => eq.soldier_name).filter(Boolean))];
      const confirmedSoldiersSet = new Set(todayConfirmations.map(c => c.soldier_name).filter(Boolean));
      
      const pending = soldiersRequiringConfirmation.filter(name => !confirmedSoldiersSet.has(name));
      setPendingSoldiers(pending);
    } catch (error) {
      console.error("Error fetching pending soldiers:", error);
      toast({ title: "שגיאה בטעינת חיילים", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPendingSoldiers();
    } else {
      setSelectedSoldiers([]); // Reset selection on close
    }
  }, [open]);

  const handleConfirm = async () => {
    if (selectedSoldiers.length === 0) {
      toast({ title: "יש לבחור לפחות חייל אחד", variant: "destructive" });
      return;
    }

    if (!window.confirm(`האם אתה בטוח שברצונך לסמן אישור ידני עבור ${selectedSoldiers.length} חיילים?`)) {
      return;
    }
    
    setIsConfirming(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      
      const confirmationPromises = selectedSoldiers.map(async (soldierName) => {
          const soldierEquipment = await Equipment.filter({
            soldier_name: soldierName,
            requires_soldier_confirmation: true,
            status: 'active'
          });
          
          if (soldierEquipment.length === 0) {
            console.warn(`לא נמצא ציוד הדורש אישור עבור ${soldierName} בעת אישור ידני.`);
            return; // Skip this soldier if no equipment is found
          }
          
          const equipmentUpdatePromises = soldierEquipment.map(equipment => 
            Equipment.update(equipment.id, { last_confirmation_date: today })
          );
          await Promise.all(equipmentUpdatePromises);
          
          return DailyConfirmation.create({
            soldier_name: soldierName,
            soldier_id: "", 
            confirmation_date: today,
            equipment_ids: soldierEquipment.map(eq => eq.id),
            confirmation_time: now,
            device_info: "Manual confirmation by admin",
            report_details: "אישור ידני על ידי מנהל",
            report_handled: true
          });
      });

      await Promise.all(confirmationPromises);
      
      toast({ title: "הצלחה!", description: `אישור ידני נוצר עבור ${selectedSoldiers.length} חיילים.` });
      
      onOpenChange(false);
      if (onConfirmationAdded) {
        onConfirmationAdded();
      }
    } catch (error) {
      console.error("Error creating manual confirmations:", error);
      toast({ title: "שגיאה ביצירת אישור ידני", description: error.message, variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };
  
  const handleSelectSoldier = (soldierName) => {
    setSelectedSoldiers(prev => 
      prev.includes(soldierName) 
        ? prev.filter(s => s !== soldierName) 
        : [...prev, soldierName]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-600" />
            אישור ידני כמנהל
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 mb-4">
            <p className="text-sm text-purple-700">
              פעולה זו תסמן את החייל(ים) שנבחרו כמי שאישרו את הציוד שלהם היום.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <div className="space-y-4">
              <Label>בחר חייל או מספר חיילים לאישור:</Label>
              
              {pendingSoldiers.length === 0 ? (
                <p className="text-center text-slate-500 py-4">
                  כל החיילים אישרו, אין צורך באישור ידני כרגע.
                </p>
              ) : (
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                  <div className="space-y-3">
                    {pendingSoldiers.map(soldierName => (
                      <div key={soldierName} className="flex items-center space-x-2">
                        <Checkbox
                          id={`soldier-${soldierName}`}
                          checked={selectedSoldiers.includes(soldierName)}
                          onCheckedChange={() => handleSelectSoldier(soldierName)}
                        />
                        <Label
                          htmlFor={`soldier-${soldierName}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {soldierName}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {selectedSoldiers.length > 0 && (
                <div className="space-y-2">
                  <Label>נבחרו:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSoldiers.map(soldier => (
                      <Badge key={soldier} variant="secondary" className="flex items-center gap-1">
                        {soldier}
                        <button onClick={() => handleSelectSoldier(soldier)} className="rounded-full hover:bg-slate-300 p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 ml-2" />
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedSoldiers.length === 0 || loading || isConfirming}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isConfirming ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <UserCheck className="w-4 h-4 ml-2" />}
            {isConfirming ? "מאשר..." : `אשר ידנית (${selectedSoldiers.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}