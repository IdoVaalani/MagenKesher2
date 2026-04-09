import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Equipment } from "@/entities/Equipment";
import { EquipmentSignature } from "@/entities/EquipmentSignature";
import { SendEmail } from "@/integrations/Core";
import { Save, X, Mail, PenTool, Search } from "lucide-react";
import { SoldierToken } from "@/entities/SoldierToken";
import DigitalSignatureDialog from "./DigitalSignatureDialog";
import { AppSettings } from "@/entities/AppSettings";
import { sendEmailHandler } from "@/functions/sendEmailHandler";
import { LocationSelectField } from "./LocationSelect";

export default function AssignEquipmentDialog({ open, onOpenChange, soldiers, equipmentTypes, assignments, onAssignSuccess }) {
  const [selectedSoldierId, setSelectedSoldierId] = useState("");
  const [selectedEquipmentTypeIds, setSelectedEquipmentTypeIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("אצל החייל");
  const [locationDetails, setLocationDetails] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState("email");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [createdEquipmentInfo, setCreatedEquipmentInfo] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelectedSoldierId("");
      setSelectedEquipmentTypeIds([]);
      setSearchTerm("");
      setLocation("אצל החייל");
      setLocationDetails("");
      setIsSaving(false);
      setSignatureMethod("email");
      setShowSignatureDialog(false);
      setCreatedEquipmentInfo(null);
    }
  }, [open]);

  // הוספת הגנה מפני props לא תקינים
  const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
  const safeEquipmentTypes = Array.isArray(equipmentTypes) ? equipmentTypes : [];
  const safeAssignments = Array.isArray(assignments) ? assignments : [];

  const [freshAssignments, setFreshAssignments] = useState(null);

  useEffect(() => {
    if (open) {
      setFreshAssignments(null);
      Equipment.list().then(data => {
        setFreshAssignments(Array.isArray(data) ? data : []);
      }).catch(() => setFreshAssignments(null));
    } else {
      setFreshAssignments(null);
    }
  }, [open]);

  const availableEquipmentTypes = useMemo(() => {
    const dataSource = freshAssignments !== null ? freshAssignments : safeAssignments;
    const assignedUniqueTypeIds = new Set(
      dataSource
        .map(a => {
            const type = safeEquipmentTypes.find(t => t.id === a.equipment_type_id);
            return (type && type.serial_number) ? type.id : null;
        })
        .filter(Boolean)
    );
    return safeEquipmentTypes.filter(type => !assignedUniqueTypeIds.has(type.id));
  }, [safeEquipmentTypes, safeAssignments, freshAssignments]);
  
  const filteredAvailableEquipmentTypes = useMemo(() => {
    if (!searchTerm) return availableEquipmentTypes;
    return availableEquipmentTypes.filter(et => 
      et.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      et.serial_number?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableEquipmentTypes, searchTerm]);

  const selectedEquipmentTypes = useMemo(() => {
    return safeEquipmentTypes.filter(et => selectedEquipmentTypeIds.includes(et.id));
  }, [safeEquipmentTypes, selectedEquipmentTypeIds]);

  const generateSoldierToken = async (soldierEmail, soldierName, equipmentTypeIds, soldierId) => {
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
      metadata: JSON.stringify({ equipment_ids: equipmentTypeIds })
    });
    
    return token;
  };

  // פונקציה לשליחת מייל בהתאם להגדרות המערכת
  const sendEmailBasedOnSettings = async (email, subject, body, from_name) => {
    const settingsData = await AppSettings.list(null, 1);
    const settings = settingsData?.[0] || {};
    const useGmailFunction = settings.default_communication_method === 'gmail';
    
    if (useGmailFunction) {
      try {
        await sendEmailHandler({ to: email, subject, body, from_name });
      } catch (gmailError) {
        console.error("Gmail function failed, falling back to built-in:", gmailError);
        await SendEmail({ to: email, subject, body, from_name });
      }
    } else {
      await SendEmail({ to: email, subject, body, from_name });
    }
  };

  const sendSignatureRequest = async (soldier, equipmentTypesToSign) => {
    try {
      const equipmentTypeIds = equipmentTypesToSign.map(et => et.id);
      const token = await generateSoldierToken(soldier.email, soldier.full_name, equipmentTypeIds, soldier.personal_id);
      const signatureUrl = `${window.location.origin}/SignEquipment?token=${token}`;
      
      const itemsList = equipmentTypesToSign.map(et => 
        `• ${et.name}${et.serial_number ? ` (צ': ${et.serial_number})` : ''}`
      ).join('\n');

      const emailBody = `שלום ${soldier.full_name},

קיבלת ציוד חדש שדורש חתימה דיגיטלית:
${itemsList}

אנא לחץ על הקישור הבא לחתימה דיגיטלית:
${signatureUrl}

הקישור תקף ל-48 שעות.
תודה,
מערכת ניהול ציוד`;

      await sendEmailBasedOnSettings(
        soldier.email,
        `בקשת חתימה דיגיטלית על ציוד`,
        emailBody,
        "מערכת ניהול ציוד"
      );
    } catch (error) {
      console.error("Error sending signature request:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSoldierId || selectedEquipmentTypeIds.length === 0) {
      alert("יש לבחור חייל ולפחות פריט ציוד אחד");
      return;
    }

    const soldier = safeSoldiers.find(s => s.id === selectedSoldierId);
    if (!soldier) {
      alert("שגיאה בנתוני החייל");
      return;
    }

    setIsSaving(true);
    try {
      const creationPromises = selectedEquipmentTypeIds.map(typeId => {
        return Equipment.create({
          soldier_name: soldier.full_name,
          soldier_id: soldier.personal_id || "",
          soldier_email: soldier.email || "",
          equipment_type_id: typeId,
          location: location,
          location_details: locationDetails.trim(),
          status: "active",
          requires_soldier_confirmation: true
        });
      });
      await Promise.all(creationPromises);
      
      const equipmentToSign = selectedEquipmentTypes;

      if (equipmentToSign.length > 0) {
        if (signatureMethod === "email") {
          if (soldier.email) {
            await sendSignatureRequest(soldier, equipmentToSign);
            alert(`הציוד שויך בהצלחה.\nנשלחה בקשת חתימה למייל עבור ${equipmentToSign.length} פריטים.`);
          } else {
            alert(`הציוד שויך בהצלחה.\nלא נשלחה בקשת חתימה כי אין מייל רשום לחייל.`);
          }
          onAssignSuccess();
        } else {
          setCreatedEquipmentInfo({ soldier, equipmentTypes: equipmentToSign });
          setShowSignatureDialog(true);
        }
      } else {
        alert(`הציוד שויך בהצלחה ל-${soldier.full_name}.`);
        onAssignSuccess();
      }
    } catch (error) {
      console.error("Error creating assignments:", error);
      alert(`שגיאה ביצירת השיוך: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureComplete = async (signatureData) => {
    setShowSignatureDialog(false);
    setIsSaving(true);
    try {
      const { soldier, equipmentTypes } = createdEquipmentInfo;
      await EquipmentSignature.create({
          soldier_name: soldier.full_name,
          soldier_id: soldier.personal_id || "",
          soldier_email: soldier.email || "",
          equipment_items: equipmentTypes.map(eq => ({
              equipment_name: eq.name,
              serial_number: eq.serial_number?.toString() || '',
              equipment_type_id: eq.id
          })),
          signature_data: signatureData,
          signature_date: new Date().toISOString().split('T')[0],
          signature_time: new Date().toLocaleTimeString('he-IL'),
          device_info: navigator.userAgent,
          status: 'active'
      });
      alert(`הציוד שויך והחתימה נשמרה בהצלחה!`);
    } catch(err) {
      alert(`שגיאה בשמירת החתימה: ${err.message}`);
    } finally {
      setCreatedEquipmentInfo(null);
      setIsSaving(false);
      onAssignSuccess();
    }
  };

  const handleSignatureCancel = () => {
    setShowSignatureDialog(false);
    setCreatedEquipmentInfo(null);
    onAssignSuccess();
  };

  return (
    <>
      <Dialog open={open && !showSignatureDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>שיוך ציוד לחייל</DialogTitle>
            <DialogDescription>בחר חייל ופריטי ציוד. ניתן לשייך מספר פריטים בו זמנית.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="soldier">בחר חייל*</Label>
              <Select onValueChange={setSelectedSoldierId} value={selectedSoldierId}>
                <SelectTrigger id="soldier">
                  <SelectValue placeholder="בחר חייל מהרשימה..." />
                </SelectTrigger>
                <SelectContent>
                  {safeSoldiers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name} {s.email ? `(${s.email})` : '(אין מייל)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="equipment-search">בחר סוגי ציוד* ({selectedEquipmentTypeIds.length} נבחרו)</Label>
               <div className="relative">
                 <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  id="equipment-search"
                  placeholder="חפש ציוד..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                {filteredAvailableEquipmentTypes.length > 0 ? filteredAvailableEquipmentTypes.map(et => (
                  <div key={et.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50">
                    <Checkbox
                      id={`eq-${et.id}`}
                      checked={selectedEquipmentTypeIds.includes(et.id)}
                      onCheckedChange={(checked) => {
                        setSelectedEquipmentTypeIds(prev =>
                          checked
                            ? [...prev, et.id]
                            : prev.filter(id => id !== et.id)
                        );
                      }}
                    />
                    <Label htmlFor={`eq-${et.id}`} className="cursor-pointer flex-1">
                      {et.name} {et.serial_number ? <span className="text-blue-600 font-mono text-xs">(צ': {et.serial_number})</span> : <span className="text-gray-500 text-xs">(נלווה)</span>}
                    </Label>
                  </div>
                )) : (
                  <p className="text-center text-sm text-slate-500 p-4">
                    {availableEquipmentTypes.length === 0 ? "כל הציוד הייחודי משויך" : "לא נמצאו תוצאות לחיפוש"}
                  </p>
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

            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-blue-800 font-semibold">שיטת חתימה על הציוד:</Label>
              <RadioGroup value={signatureMethod} onValueChange={setSignatureMethod}>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="email" id="email" />
                  <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="w-4 h-4 text-blue-600" />
                    שלח מייל לחייל לחתימה עצמית
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="direct" id="direct" />
                  <Label htmlFor="direct" className="flex items-center gap-2 cursor-pointer">
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
              <Button type="submit" disabled={isSaving || selectedEquipmentTypeIds.length === 0}>
                <Save className="w-4 h-4 ml-2" /> {isSaving ? "שומר..." : "שמור שיוך"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showSignatureDialog && createdEquipmentInfo && (
        <DigitalSignatureDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          soldier={createdEquipmentInfo.soldier}
          equipmentTypes={createdEquipmentInfo.equipmentTypes}
          onSignatureComplete={handleSignatureComplete}
          onCancel={handleSignatureCancel}
        />
      )}
    </>
  );
}