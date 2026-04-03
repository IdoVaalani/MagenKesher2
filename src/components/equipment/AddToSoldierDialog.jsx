import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Equipment } from "@/entities/Equipment";
import { SendEmail } from "@/integrations/Core"; // Keep this import for fallback
import { SoldierToken } from "@/entities/SoldierToken";
import { Save, X, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, PenTool } from "lucide-react";
import DigitalSignatureDialog from "./DigitalSignatureDialog";
import { EquipmentSignature } from "@/entities/EquipmentSignature"; // Import EquipmentSignature
import { AppSettings } from "@/entities/AppSettings"; // New import
import { sendEmailHandler } from "@/functions/sendEmailHandler"; // New import

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
  const [selectedEquipmentTypeId, setSelectedEquipmentTypeId] = useState("");
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState("email");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [createdEquipment, setCreatedEquipment] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelectedEquipmentTypeId("");
      setLocation("אצל החייל");
      setLocationDetails("");
      setIsSaving(false);
      setSignatureMethod("email");
      setShowSignatureDialog(false);
      setCreatedEquipment(null);
    }
  }, [open]);

  const availableEquipmentTypes = useMemo(() => {
    if (!Array.isArray(equipmentTypes) || !Array.isArray(assignments)) return [];

    const assignedUniqueTypeIds = new Set(
      assignments
        .map(a => {
          const type = equipmentTypes.find(t => t.id === a.equipment_type_id);
          return (type && type.serial_number) ? type.id : null;
        })
        .filter(Boolean)
    );

    return equipmentTypes.filter(type => !assignedUniqueTypeIds.has(type.id));
  }, [equipmentTypes, assignments]);
  
  const selectedEquipmentType = useMemo(() => {
    return equipmentTypes.find(et => et.id === selectedEquipmentTypeId);
  }, [equipmentTypes, selectedEquipmentTypeId]);

  const generateSoldierToken = async (equipmentType) => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours validity
    
    await SoldierToken.create({
      soldier_name: soldierName,
      soldier_email: soldierEmail,
      soldier_id: soldierId || '',
      token: token,
      token_type: "equipment_signature", // Corrected token type
      expires_at: expiresAt.toISOString(),
      used: false,
      metadata: JSON.stringify({ equipment_ids: [equipmentType.id] })
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

  const sendSignatureRequest = async (equipmentType) => {
    try {
      const token = await generateSoldierToken(equipmentType);
      const signatureUrl = `${window.location.origin}/SignEquipment?token=${token}`;
      
      const emailBody = `שלום ${soldierName},

קיבלת ציוד נוסף שדורש חתימה דיגיטלית:
• ${equipmentType.name}${equipmentType.serial_number ? ` (צ': ${equipmentType.serial_number})` : ''}

אנא לחץ על הקישור הבא לחתימה דיגיטלית:
${signatureUrl}

הקישור תקף ל-48 שעות.
לא נדרשת התחברות - פשוט לחץ וחתום!

תודה,
מערכת ניהול ציוד`;

      await sendEmailBasedOnSettings( // Using the new function
        soldierEmail,
        `בקשת חתימה דיגיטלית - ${equipmentType.name}`,
        emailBody,
        "מערכת ניהול ציוד"
      );

      console.log(`Signature request sent to ${soldierName} for ${equipmentType.name}`);
    } catch (error) {
      console.error("Error sending signature request:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipmentTypeId) {
      alert("יש לבחור סוג ציוד");
      return;
    }

    if (!selectedEquipmentType) {
      alert("שגיאה בנתוני הציוד");
      return;
    }

    setIsSaving(true);
    try {
      const newEquipmentAssignment = await Equipment.create({ // Save the created assignment
        soldier_name: soldierName,
        soldier_id: soldierId || "",
        soldier_email: soldierEmail || "",
        equipment_type_id: selectedEquipmentTypeId,
        location: location,
        location_details: locationDetails.trim(),
        status: "active",
        requires_soldier_confirmation: true
      });

      if (signatureMethod === "email") {
        if (soldierEmail) {
          await sendSignatureRequest(selectedEquipmentType);
          alert(`הציוד נוסף בהצלחה ל-${soldierName}.\nנשלחה בקשת חתימה דיגיטלית למייל: ${soldierEmail}`);
        } else {
          alert(`הציוד נוסף בהצלחה ל-${soldierName}.\nלא נשלחה בקשת חתימה כי אין מייל רשום לחייל.`);
        }
        onAssignSuccess();
      } else {
        setCreatedEquipment({ 
          soldier: { full_name: soldierName, personal_id: soldierId, email: soldierEmail }, 
          equipmentType: selectedEquipmentType,
          assignmentId: newEquipmentAssignment.id // Pass the assignment ID
        });
        setShowSignatureDialog(true);
      }
    } catch (error) {
      console.error("Error creating assignment:", error);
      alert(`שגיאה ביצירת השיוך: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureComplete = async (signatureData) => { // Updated to be async
    setShowSignatureDialog(false);
    setIsSaving(true); // Indicate saving process
    try {
      const { soldier, equipmentType, assignmentId } = createdEquipment;
      // Create signature record
      await EquipmentSignature.create({
          soldier_name: soldier.full_name,
          soldier_id: soldier.personal_id || "",
          soldier_email: soldier.email || "",
          equipment_items: [{
              equipment_name: equipmentType.name,
              serial_number: equipmentType.serial_number?.toString() || '',
              equipment_type_id: equipmentType.id,
              assignment_id: assignmentId // Link to the specific assignment
          }],
          signature_data: signatureData,
          signature_date: new Date().toISOString().split('T')[0],
          signature_time: new Date().toLocaleTimeString('he-IL'),
          device_info: navigator.userAgent,
          status: 'active'
      });
      alert(`הציוד נוסף והחתימה נשמרה בהצלחה!`);
    } catch(err) {
      console.error("Error saving signature:", err);
      alert(`שגיאה בשמירת החתימה: ${err.message}`);
    } finally {
      setCreatedEquipment(null);
      setIsSaving(false);
      onAssignSuccess();
    }
  };

  const handleSignatureCancel = () => {
    setShowSignatureDialog(false);
    setCreatedEquipment(null);
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
          
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700">
                <p><strong>שם החייל:</strong> {soldierName}</p>
                {soldierId && <p><strong>מספר אישי:</strong> {soldierId}</p>}
                {soldierEmail && <p><strong>מייל:</strong> {soldierEmail}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipment-type">בחר סוג ציוד להוספה*</Label>
              <Select onValueChange={setSelectedEquipmentTypeId} value={selectedEquipmentTypeId}>
                <SelectTrigger id="equipment-type">
                  <SelectValue placeholder="בחר ציוד מהמלאי..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEquipmentTypes.map(et => (
                    <SelectItem key={et.id} value={et.id}>
                      {et.name} 
                      {et.serial_number ? 
                        ` (צ': ${et.serial_number}) - ייחודי` : 
                        ' - נלווה'
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableEquipmentTypes.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  אין ציוד זמין להוספה. כל הציוד הייחודי כבר משויך.
                </p>
              )}
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
                  <RadioGroupItem value="email" id="email-add" disabled={!soldierEmail} />
                  <Label htmlFor="email-add" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="w-4 h-4 text-blue-600" />
                    שלח מייל לחייל לחתימה עצמית
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="direct" id="direct-add" />
                  <Label htmlFor="direct-add" className="flex items-center gap-2 cursor-pointer">
                    <PenTool className="w-4 h-4 text-green-600" />
                    חתום עבור החייל כעת במערכת
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-sm text-blue-600">
                {signatureMethod === "email" 
                  ? (soldierEmail ? "החייל יקבל מייל עם קישור לחתימה דיגיטלית" : "אין מייל רשום לחייל, לכן לא ניתן לשלוח בקשת חתימה במייל.")
                  : "תוכל לחתום עבור החייל ישירות במערכת"}
              </p>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                <X className="w-4 h-4 ml-2" /> ביטול
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving || availableEquipmentTypes.length === 0 || (signatureMethod === "email" && !soldierEmail)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 ml-2" /> 
                {isSaving ? "מוסיף..." : "הוסף ציוד"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Digital Signature Dialog */}
      {showSignatureDialog && createdEquipment && (
        <DigitalSignatureDialog
          open={showSignatureDialog}
          onOpenChange={setShowSignatureDialog}
          soldier={createdEquipment.soldier}
          equipmentTypes={[createdEquipment.equipmentType]}
          onSignatureComplete={handleSignatureComplete}
          onCancel={handleSignatureCancel}
        />
      )}
    </>
  );
}