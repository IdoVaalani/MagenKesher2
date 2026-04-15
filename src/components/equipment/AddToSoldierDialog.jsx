import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Equipment } from "@/entities/Equipment";
import { SendEmail } from "@/integrations/Core";
import { SoldierToken } from "@/entities/SoldierToken";
import { X, Plus, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, PenTool } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import DigitalSignatureDialog from "./DigitalSignatureDialog";
import { EquipmentSignature } from "@/entities/EquipmentSignature";
import { AppSettings } from "@/entities/AppSettings";
import { sendEmailHandler } from "@/functions/sendEmailHandler";
import { LocationSelectField } from "./LocationSelect";

export default function AddToSoldierDialog({ 
  open, 
  onOpenChange, 
  soldierName, 
  soldierId, 
  soldierEmail, 
  equipmentTypes, 
  assignments, 
  onAssignSuccess 
}) {
  const [selectedTypeIds, setSelectedTypeIds] = useState(new Set());
  const [ancillaryQuantities, setAncillaryQuantities] = useState({});
  const [searchFilter, setSearchFilter] = useState("");
  const [location, setLocation] = useState("אצל החייל");
  const [locationDetails, setLocationDetails] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState("email");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [createdEquipmentList, setCreatedEquipmentList] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelectedTypeIds(new Set());
      setAncillaryQuantities({});
      setSearchFilter("");
      setLocation("אצל החייל");
      setLocationDetails("");
      setIsSaving(false);
      setSignatureMethod("email");
      setShowSignatureDialog(false);
      setCreatedEquipmentList(null);
    }
  }, [open]);

  const [allSystemAssignments, setAllSystemAssignments] = useState(null);

  // טעינת כל השיוכים מהמערכת בפתיחת הדיאלוג כדי לוודא נתונים עדכניים
  useEffect(() => {
    if (open) {
      setAllSystemAssignments(null);
      Equipment.list().then(data => {
        setAllSystemAssignments(Array.isArray(data) ? data : []);
      }).catch(() => setAllSystemAssignments(null));
    } else {
      setAllSystemAssignments(null);
    }
  }, [open]);

  const availableEquipmentTypes = useMemo(() => {
    if (!Array.isArray(equipmentTypes)) return [];
    const dataSource = allSystemAssignments !== null ? allSystemAssignments : (assignments || []);

    // אסוף את כל מספרי הצ' הייחודיים שכבר משויכים לכל חייל במערכת
    const assignedSerialNumbers = new Set(
      dataSource
        .map(a => {
          const type = equipmentTypes.find(t => t.id === a.equipment_type_id);
          return (type && type.serial_number) ? type.serial_number : null;
        })
        .filter(sn => sn !== null && sn !== 0)
    );

    return equipmentTypes.filter(type => {
      // ציוד ייחודי (עם מספר צ') - חסום אם המספר כבר משויך
      if (type.serial_number && type.serial_number !== 0) {
        return !assignedSerialNumbers.has(type.serial_number);
      }
      // ציוד נלווה (בלי מספר צ') - תמיד זמין
      return true;
    });
  }, [equipmentTypes, assignments, allSystemAssignments]);
  
  const selectedEquipmentTypesList = useMemo(() => {
    return equipmentTypes.filter(et => selectedTypeIds.has(et.id));
  }, [equipmentTypes, selectedTypeIds]);

  const totalItemsToCreate = useMemo(() => {
    let count = 0;
    for (const et of selectedEquipmentTypesList) {
      if (isAncillary(et)) {
        count += (ancillaryQuantities[et.id] || 1);
      } else {
        count += 1;
      }
    }
    return count;
  }, [selectedEquipmentTypesList, ancillaryQuantities]);

  const filteredAvailable = useMemo(() => {
    if (!searchFilter.trim()) return availableEquipmentTypes;
    const q = searchFilter.toLowerCase();
    return availableEquipmentTypes.filter(et =>
      et.name?.toLowerCase().includes(q) ||
      et.serial_number?.toString().includes(q)
    );
  }, [availableEquipmentTypes, searchFilter]);

  const isAncillary = (et) => !et.serial_number || et.serial_number === 0;

  const toggleSelection = (id) => {
    const et = equipmentTypes.find(t => t.id === id);
    setSelectedTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (et && isAncillary(et)) {
          setAncillaryQuantities(prev => { const n = {...prev}; delete n[id]; return n; });
        }
      } else {
        next.add(id);
        if (et && isAncillary(et) && !ancillaryQuantities[id]) {
          setAncillaryQuantities(prev => ({ ...prev, [id]: 1 }));
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTypeIds(new Set(filteredAvailable.map(et => et.id)));
  };

  const deselectAll = () => {
    setSelectedTypeIds(new Set());
  };

  const generateSoldierToken = async (equipmentTypesList) => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);
    
    await SoldierToken.create({
      soldier_name: soldierName,
      soldier_email: soldierEmail,
      soldier_id: soldierId || '',
      token: token,
      token_type: "equipment_signature",
      expires_at: expiresAt.toISOString(),
      used: false,
      metadata: JSON.stringify({ equipment_ids: equipmentTypesList.map(et => et.id) })
    });
    
    return token;
  };

  // פונקציה לשליחת מייל בהתאם להגדרות המערכת
  const sendEmailBasedOnSettings = async (email, subject, body, from_name) => {
    try {
      const settingsData = await AppSettings.list(null, 1);
      const settings = settingsData?.[0] || {};
      const useGmailFunction = settings.default_communication_method === 'gmail';
      
      if (useGmailFunction) {
        try {
          await sendEmailHandler({ to: email, subject, body, from_name });
        } catch (gmailError) {
          console.error("Gmail function failed, falling back to built-in SendEmail:", gmailError);
          // Fallback to the original SendEmail if sendEmailHandler fails
          await SendEmail({ to: email, subject, body, from_name });
        }
      } else {
        // Use the original SendEmail if not configured for Gmail or if it's the default
        await SendEmail({ to: email, subject, body, from_name });
      }
    } catch (error) {
      console.error("Error determining email sending method or sending email:", error);
      // Ensure original SendEmail is attempted as a final fallback if settings retrieval fails
      await SendEmail({ to: email, subject, body, from_name });
    }
  };

  const sendSignatureRequest = async (typesToSign) => {
    try {
      const token = await generateSoldierToken(typesToSign);
      const signatureUrl = `${window.location.origin}/SignEquipment?token=${token}`;
      
      const itemsList = typesToSign.map(et =>
        `\u2022 ${et.name}${et.serial_number ? ` (\u05e6': ${et.serial_number})` : ''}`
      ).join('\n');

      const emailBody = `\u05e9\u05dc\u05d5\u05dd ${soldierName},\n\n\u05e7\u05d9\u05d1\u05dc\u05ea \u05e6\u05d9\u05d5\u05d3 \u05e9\u05d3\u05d5\u05e8\u05e9 \u05d7\u05ea\u05d9\u05de\u05d4 \u05d3\u05d9\u05d2\u05d9\u05d8\u05dc\u05d9\u05ea:\n${itemsList}\n\n\u05d0\u05e0\u05d0 \u05dc\u05d7\u05e5 \u05e2\u05dc \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d1\u05d0 \u05dc\u05d7\u05ea\u05d9\u05de\u05d4 \u05d3\u05d9\u05d2\u05d9\u05d8\u05dc\u05d9\u05ea:\n${signatureUrl}\n\n\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05ea\u05e7\u05e3 \u05dc-48 \u05e9\u05e2\u05d5\u05ea.\n\u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9\u05ea \u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea - \u05e4\u05e9\u05d5\u05d8 \u05dc\u05d7\u05e5 \u05d5\u05d7\u05ea\u05d5\u05dd!\n\n\u05ea\u05d5\u05d3\u05d4,\n\u05de\u05e2\u05e8\u05db\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05e6\u05d9\u05d5\u05d3`;

      await sendEmailBasedOnSettings(
        soldierEmail,
        `\u05d1\u05e7\u05e9\u05ea \u05d7\u05ea\u05d9\u05de\u05d4 \u05d3\u05d9\u05d2\u05d9\u05d8\u05dc\u05d9\u05ea - ${typesToSign.length} \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd`,
        emailBody,
        "\u05de\u05e2\u05e8\u05db\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05e6\u05d9\u05d5\u05d3"
      );
    } catch (error) {
      console.error("Error sending signature request:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedTypeIds.size === 0) {
      alert("יש לבחור לפחות פריט ציוד אחד");
      return;
    }

    setIsSaving(true);
    try {
      const createdAssignments = [];
      for (const typeId of selectedTypeIds) {
        const et = equipmentTypes.find(t => t.id === typeId);
        const qty = (et && isAncillary(et)) ? (ancillaryQuantities[typeId] || 1) : 1;
        for (let i = 0; i < qty; i++) {
          const eq = await Equipment.create({
            soldier_name: soldierName,
            soldier_id: soldierId || "",
            soldier_email: soldierEmail || "",
            equipment_type_id: typeId,
            location: location,
            location_details: locationDetails.trim(),
            status: "active",
            requires_soldier_confirmation: true
          });
          createdAssignments.push({ id: eq.id, typeId });
        }
      }

      if (signatureMethod === "email") {
        if (soldierEmail) {
          await sendSignatureRequest(selectedEquipmentTypesList);
          alert(`${createdAssignments.length} פריטי ציוד נוספו בהצלחה ל-${soldierName}.\nנשלחה בקשת חתימה דיגיטלית למייל: ${soldierEmail}`);
        } else {
          alert(`${createdAssignments.length} פריטי ציוד נוספו בהצלחה ל-${soldierName}.\nלא נשלחה בקשת חתימה כי אין מייל רשום לחייל.`);
        }
        onAssignSuccess();
      } else {
        setCreatedEquipmentList({
          soldier: { full_name: soldierName, personal_id: soldierId, email: soldierEmail },
          items: selectedEquipmentTypesList.map((et, i) => ({
            equipmentType: et,
            assignmentId: createdAssignments.find(a => a.typeId === et.id)?.id
          }))
        });
        setShowSignatureDialog(true);
      }
    } catch (error) {
      console.error("Error creating assignments:", error);
      alert(`שגיאה ביצירת השיוכים: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureComplete = async (signatureData) => {
    setShowSignatureDialog(false);
    setIsSaving(true);
    try {
      const { soldier, items } = createdEquipmentList;
      await EquipmentSignature.create({
          soldier_name: soldier.full_name,
          soldier_id: soldier.personal_id || "",
          soldier_email: soldier.email || "",
          equipment_items: items.map(item => ({
              equipment_name: item.equipmentType.name,
              serial_number: item.equipmentType.serial_number?.toString() || '',
              equipment_type_id: item.equipmentType.id,
              assignment_id: item.assignmentId
          })),
          signature_data: signatureData,
          signature_date: new Date().toISOString().split('T')[0],
          signature_time: new Date().toLocaleTimeString('he-IL'),
          device_info: navigator.userAgent,
          status: 'active'
      });
      alert(`${items.length} פריטי ציוד נוספו והחתימה נשמרה בהצלחה!`);
    } catch(err) {
      console.error("Error saving signature:", err);
      alert(`שגיאה בשמירת החתימה: ${err.message}`);
    } finally {
      setCreatedEquipmentList(null);
      setIsSaving(false);
      onAssignSuccess();
    }
  };

  const handleSignatureCancel = () => {
    setShowSignatureDialog(false);
    setCreatedEquipmentList(null);
    onAssignSuccess();
  };

  return (
    <>
      <Dialog open={open && !showSignatureDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              הוספת ציוד ל{soldierName}
            </DialogTitle>
            <DialogDescription>
              {soldierEmail ? "הציוד יתווסף לחייל ותוכל לבקש חתימה דיגיטלית במייל או לחתום ישירות במערכת." : "הציוד יתווסף לחייל. לא ניתן לבקש חתימה דיגיטלית במייל כי אין מייל רשום לחייל."}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700">
                <p><strong>שם החייל:</strong> {soldierName}</p>
                {soldierId && <p><strong>מספר אישי:</strong> {soldierId}</p>}
                {soldierEmail && <p><strong>מייל:</strong> {soldierEmail}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">בחר ציוד להוספה ({selectedTypeIds.size} נבחרו)*</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={selectAll}>בחר הכל</Button>
                  {selectedTypeIds.size > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7 px-2 text-red-600" onClick={deselectAll}>נקה הכל</Button>
                  )}
                </div>
              </div>
              {availableEquipmentTypes.length > 5 && (
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="חפש ציוד..."
                    className="pr-9"
                  />
                </div>
              )}
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {filteredAvailable.length === 0 ? (
                  <p className="text-sm text-slate-500 p-3 text-center">
                    {availableEquipmentTypes.length === 0 ? "אין ציוד זמין להוספה" : "לא נמצאו תוצאות"}
                  </p>
                ) : (
                  filteredAvailable.map(et => {
                    const ancillary = isAncillary(et);
                    const selected = selectedTypeIds.has(et.id);
                    return (
                      <div
                        key={et.id}
                        className={`flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors ${
                          selected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleSelection(et.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{et.name}</p>
                            <p className="text-xs text-slate-500">
                              {et.serial_number ? `צ': ${et.serial_number} - ייחודי` : 'נלווה'}
                            </p>
                          </div>
                        </label>
                        {ancillary && selected && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAncillaryQuantities(prev => ({
                                  ...prev,
                                  [et.id]: Math.max(1, (prev[et.id] || 1) - 1)
                                }));
                              }}
                            >-</Button>
                            <span className="w-6 text-center text-sm font-medium">{ancillaryQuantities[et.id] || 1}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAncillaryQuantities(prev => ({
                                  ...prev,
                                  [et.id]: (prev[et.id] || 1) + 1
                                }));
                              }}
                            >+</Button>
                          </div>
                        )}
                      </div>
                    );
                  }))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium">מיקום הציוד</Label>
              <LocationSelectField
                value={location}
                onChange={setLocation}
                details={locationDetails}
                onDetailsChange={setLocationDetails}
              />
            </div>

            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-blue-800 font-semibold">שיטת חתימה על הציוד:</Label>
              <RadioGroup value={signatureMethod} onValueChange={setSignatureMethod}>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="email" id="email-add" disabled={!soldierEmail} />
                  <Label htmlFor="email-add" className="flex items-center gap-2 cursor-pointer text-sm">
                    <Mail className="w-4 h-4 text-blue-600" />
                    שלח מייל לחייל לחתימה עצמית
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="direct" id="direct-add" />
                  <Label htmlFor="direct-add" className="flex items-center gap-2 cursor-pointer text-sm">
                    <PenTool className="w-4 h-4 text-green-600" />
                    חתום עבור החייל כעת במערכת
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                <X className="w-4 h-4 ml-2" /> ביטול
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving || selectedTypeIds.size === 0 || (signatureMethod === "email" && !soldierEmail)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 ml-2" /> 
                {isSaving ? "מוסיף..." : `הוסף ${totalItemsToCreate || ''} ציוד`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Digital Signature Dialog */}
      {showSignatureDialog && createdEquipmentList && (
        <DigitalSignatureDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          soldier={createdEquipmentList.soldier}
          equipmentTypes={createdEquipmentList.items.map(i => i.equipmentType)}
          onSignatureComplete={handleSignatureComplete}
          onCancel={handleSignatureCancel}
        />
      )}
    </>
  );
}