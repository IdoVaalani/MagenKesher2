import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertCircle, Package, UserCheck } from "lucide-react";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { DailyConfirmation } from "@/entities/DailyConfirmation";

export default function PartialConfirmationDialog({ open, onOpenChange, soldierName, onConfirmationUpdated }) {
  const [soldierEquipment, setSoldierEquipment] = useState([]);
  const [confirmedItems, setConfirmedItems] = useState(new Set());
  const [itemsToConfirm, setItemsToConfirm] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open && soldierName) {
      loadSoldierEquipmentStatus();
    }
  }, [open, soldierName]);

  const loadSoldierEquipmentStatus = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // טוען את כל הציוד של החייל
      const allEquipment = await Equipment.filter({
        soldier_name: soldierName,
        requires_soldier_confirmation: true,
        status: 'active'
      });

      // טוען את סוגי הציוד
      const equipmentTypes = await EquipmentType.list();
      const typesMap = new Map(equipmentTypes.map(t => [t.id, t]));

      // טוען את האישורים של היום
      const todayConfirmations = await DailyConfirmation.filter({
        soldier_name: soldierName,
        confirmation_date: today
      });

      const confirmedEquipmentIds = new Set();
      todayConfirmations.forEach(conf => {
        conf.equipment_ids?.forEach(id => confirmedEquipmentIds.add(id));
      });

      // יוצר רשימת ציוד עם סטטוס אישור
      const equipmentWithStatus = allEquipment.map(eq => {
        const type = typesMap.get(eq.equipment_type_id);
        return {
          ...eq,
          typeName: type?.name || 'לא ידוע',
          serialNumber: type?.serial_number || null,
          isConfirmed: confirmedEquipmentIds.has(eq.id)
        };
      });

      setSoldierEquipment(equipmentWithStatus);
      setConfirmedItems(confirmedEquipmentIds);
      setItemsToConfirm(new Set());

    } catch (error) {
      console.error("Error loading soldier equipment status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemToggle = (itemId, isChecked) => {
    const newItemsToConfirm = new Set(itemsToConfirm);
    if (isChecked) {
      newItemsToConfirm.add(itemId);
    } else {
      newItemsToConfirm.delete(itemId);
    }
    setItemsToConfirm(newItemsToConfirm);
  };

  const handleConfirm = async () => {
    if (itemsToConfirm.size === 0) {
      alert("יש לבחור לפחות פריט אחד לאישור.");
      return;
    }

    if (!window.confirm(`האם לאשר ${itemsToConfirm.size} פריטים עבור ${soldierName}?`)) {
      return;
    }

    setConfirming(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

      // עדכון תאריך אישור אחרון בפריטי הציוד
      const updatePromises = Array.from(itemsToConfirm).map(itemId => 
        Equipment.update(itemId, { last_confirmation_date: today })
      );
      await Promise.all(updatePromises);

      // מחיקת אישורים קודמים של אותו חייל מאותו יום
      const existingConfirmations = await DailyConfirmation.filter({
        soldier_name: soldierName,
        confirmation_date: today
      });

      for (const oldConf of existingConfirmations) {
        await DailyConfirmation.delete(oldConf.id);
      }

      // יצירת אישור חדש עם כל הפריטים המאושרים (ישנים + חדשים)
      const allConfirmedItems = new Set([...confirmedItems, ...itemsToConfirm]);
      const totalEquipmentCount = soldierEquipment.length;
      const isCompleteConfirmation = allConfirmedItems.size === totalEquipmentCount;

      await DailyConfirmation.create({
        soldier_name: soldierName,
        soldier_id: "",
        confirmation_date: today,
        equipment_ids: Array.from(allConfirmedItems),
        total_equipment_count: totalEquipmentCount,
        is_complete_confirmation: isCompleteConfirmation,
        confirmation_time: now,
        device_info: "Admin confirmation",
        report_details: `אישור מנהל עבור ${itemsToConfirm.size} פריטים נוספים`,
        report_handled: true
      });

      alert(`${itemsToConfirm.size} פריטים אושרו בהצלחה עבור ${soldierName}.`);
      onOpenChange(false);
      if (onConfirmationUpdated) {
        onConfirmationUpdated();
      }

    } catch (error) {
      console.error("Error confirming items:", error);
      alert("שגיאה באישור הפריטים.");
    } finally {
      setConfirming(false);
    }
  };

  const unconfirmedItems = soldierEquipment.filter(item => !item.isConfirmed);
  const confirmedItemsCount = soldierEquipment.filter(item => item.isConfirmed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-600" />
            סטטוס אישור - {soldierName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>אושר: {confirmedItemsCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <span>לא אושר: {unconfirmedItems.length}</span>
                </div>
              </div>
            </div>

            {unconfirmedItems.length > 0 ? (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  פריטים שלא אושרו - בחר לאישור:
                </h4>
                <ScrollArea className="h-48 border rounded-lg p-3">
                  <div className="space-y-3">
                    {unconfirmedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-orange-50 rounded border border-orange-200">
                        <Checkbox
                          checked={itemsToConfirm.has(item.id)}
                          onCheckedChange={(checked) => handleItemToggle(item.id, checked)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{item.typeName}</div>
                          <div className="text-sm text-slate-600">
                            {item.serialNumber ? `צ': ${item.serialNumber}` : 'ללא צ\''}
                            {item.location && ` • ${item.location}`}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          לא אושר
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium">כל הציוד אושר!</p>
              </div>
            )}

            {soldierEquipment.filter(item => item.isConfirmed).length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-green-700">פריטים שכבר אושרו:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {soldierEquipment.filter(item => item.isConfirmed).map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-green-50 rounded border border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <div className="flex-1">
                        <span className="font-medium">{item.typeName}</span>
                        <span className="text-sm text-slate-600 mr-2">
                          {item.serialNumber ? `(צ': ${item.serialNumber})` : '(ללא צ\')'}
                        </span>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        אושר
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          {unconfirmedItems.length > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={confirming || itemsToConfirm.size === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {confirming ? "מאשר..." : `אשר פריטים נבחרים (${itemsToConfirm.size})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}