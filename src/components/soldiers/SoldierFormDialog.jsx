import React, { useState, useEffect } from "react";
import { useCompany } from "@/components/CompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export default function SoldierFormDialog({ open, onOpenChange, onSave, editingSoldier }) {
  const { currentCompany } = useCompany();
  const [fullName, setFullName] = useState("");
  const [personalId, setPersonalId] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('user');
  const [preferredCommunicationMethod, setPreferredCommunicationMethod] = useState('default');
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingSoldier) {
      setFullName(editingSoldier.full_name || "");
      setPersonalId(editingSoldier.personal_id || "");
      setEmail(editingSoldier.email || "");
      setPhoneNumber(editingSoldier.phone_number || "");
      setRole(editingSoldier.role || "user");
      setPreferredCommunicationMethod(editingSoldier.preferred_communication_method || "default");
    } else {
      setFullName("");
      setPersonalId("");
      setEmail("");
      setPhoneNumber("");
      setRole("user");
      setPreferredCommunicationMethod("default");
    }
    setError("");
  }, [editingSoldier, open]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName) {
      setError("שם מלא הוא שדה חובה");
      return;
    }
    
    // נרמול מספר הטלפון - אם לא מתחיל ב-+ נוסיף +972
    let normalizedPhone = phoneNumber;
    if (phoneNumber && phoneNumber.trim() !== '') {
      if (!phoneNumber.startsWith('+')) {
        // אם המספר מתחיל ב-0, נסיר אותו ונוסיף +972
        if (phoneNumber.startsWith('0')) {
          normalizedPhone = '+972' + phoneNumber.substring(1);
        } else {
          // אם לא מתחיל ב-0, פשוט נוסיף +972
          normalizedPhone = '+972' + phoneNumber;
        }
      }
    }
    
    setError("");

    await onSave({
      company_id: currentCompany.id,
      full_name: fullName,
      personal_id: personalId,
      email: email,
      phone_number: normalizedPhone,
      role: role,
      preferred_communication_method: preferredCommunicationMethod,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingSoldier ? "עריכת פרטי חייל" : "הוספת חייל חדש"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">שם מלא*</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal_id">מספר אישי</Label>
            <Input id="personal_id" value={personalId} onChange={(e) => setPersonalId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">כתובת מייל</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone_number">מספר טלפון</Label>
            <Input
              id="phone_number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="לדוגמה: 0501234567"
              dir="ltr"
              className="text-left"
            />
            <p className="text-xs text-gray-500">
              ניתן להכניס מספר רגיל (0501234567) או עם קידומת בינלאומית (+972501234567)
            </p>
          </div>

          {/* Role selection field */}
          <div className="space-y-2">
            <Label htmlFor="role">תפקיד במערכת</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="user">חייל (גישה לאישור יומי בלבד)</option>
              <option value="admin">מנהל (גישה מלאה למערכת)</option>
            </select>
            <p className="text-sm text-gray-500">
              {role === 'admin' 
                ? "מנהל: יכול לגשת לכל חלקי המערכת - לוח בקרה, ניהול ציוד, הגדרות וכו'" 
                : "חייל: יכול לגשת רק לדף האישור היומי שלו"
              }
            </p>
          </div>
          
          {/* Communication preference field - updated */}
          <div className="space-y-2">
            <Label htmlFor="preferred_communication_method">העדפת תקשורת</Label>
            <Select
              value={preferredCommunicationMethod || "default"}
              onValueChange={(value) => setPreferredCommunicationMethod(value)}
            >
              <SelectTrigger id="preferred_communication_method">
                <SelectValue placeholder="בחר שיטת תקשורת מועדפת" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">לפי הגדרות המערכת</SelectItem>
                <SelectItem value="email">מייל (מובנית)</SelectItem>
                <SelectItem value="gmail">מייל גוגל</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              {preferredCommunicationMethod === 'default'
                ? "המערכת תשלח הודעות לפי ההגדרה הכללית (מוגדר בעמוד ההגדרות)."
                : preferredCommunicationMethod === 'email'
                ? "החייל יקבל הודעות רק במייל המובנה של המערכת (ללא שימוש ב-Gmail)."
                : preferredCommunicationMethod === 'gmail'
                ? "החייל יקבל הודעות באמצעות חשבון הגוגל שלו. אם שליחה דרך גוגל תיכשל, המערכת תנסה לשלוח דרך המייל המובנה כגיבוי."
                : "החייל יקבל הודעות רק בהודעות SMS."
              }
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button type="submit">שמור</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}