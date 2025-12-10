import React, { useState, useEffect } from "react";
import { useCompany } from "@/components/CompanyContext";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { Soldier } from "@/entities/Soldier";
import { User } from "@/entities/User";
import { AppSettings } from "@/entities/AppSettings";
import { DailyConfirmation as DailyConfirmationEntity } from "@/entities/DailyConfirmation";
import { SoldierToken } from "@/entities/SoldierToken";
import { SendEmail } from "@/integrations/Core";
import { sendEmailHandler } from "@/functions/sendEmailHandler";
import { sendSms } from "@/functions/sendSms";
import { Button } from "@/components/ui/button";
import { Plus, Download, Mail, Trash2, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import AssignmentsTable from "../components/equipment/AssignmentsTable";
import AssignEquipmentDialog from "../components/equipment/AssignEquipmentDialog";
import AddToSoldierDialog from "../components/equipment/AddToSoldierDialog";
import SoldierEquipmentDetailsDialog from "../components/equipment/SoldierEquipmentDetailsDialog";
import TransferEquipmentDialog from "../components/equipment/TransferEquipmentDialog";

export default function EquipmentManagement() {
  const { currentCompany } = useCompany();
  const [assignments, setAssignments] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationUpdates, setLocationUpdates] = useState({});
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAddToSoldierDialog, setShowAddToSoldierDialog] = useState(false);
  const [selectedSoldierForAdd, setSelectedSoldierForAdd] = useState(null);
  const [showSoldierDetailsDialog, setShowSoldierDetailsDialog] = useState(false);
  const [selectedSoldierForDetails, setSelectedSoldierForDetails] = useState(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedEquipmentForTransfer, setSelectedEquipmentForTransfer] = useState(null);

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (!showSoldierDetailsDialog) {
      setSelectedSoldierForDetails(null);
    }
  }, [showSoldierDetailsDialog]);

  const loadData = async () => {
    setLoading(true);
    try {
      const loadWithRetry = async (entityFunction, entityName, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await entityFunction();
            return Array.isArray(result) ? result : [];
          } catch (error) {
            console.error(`שגיאה בטעינת ${entityName}, ניסיון ${attempt}:`, error);
            if (attempt === maxRetries) {
              console.error(`נכשל בטעינת ${entityName} אחרי ${maxRetries} ניסיונות`);
              return [];
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      };

      const [assignmentsResult, typesResult, soldiersResult] = await Promise.allSettled([
        loadWithRetry(() => Equipment.filter({ company_id: currentCompany.id }, "-created_date"), "Equipment"),
        loadWithRetry(() => EquipmentType.filter({ company_id: currentCompany.id }), "EquipmentType"),
        loadWithRetry(() => Soldier.filter({ company_id: currentCompany.id }), "Soldier"),
      ]);
      
      const loadedAssignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
      const loadedEquipmentTypes = typesResult.status === 'fulfilled' ? typesResult.value : [];
      const loadedSoldiers = soldiersResult.status === 'fulfilled' ? soldiersResult.value : [];
      
      setAssignments(loadedAssignments || []);
      setEquipmentTypes(loadedEquipmentTypes || []);
      setSoldiers(loadedSoldiers || []);

    } catch (error) {
      console.error("שגיאה כללית בטעינת נתונים:", error);
      setAssignments([]);
      setEquipmentTypes([]);
      setSoldiers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = (itemId, newLocation) => {
    setLocationUpdates(prev => ({
      ...prev,
      [itemId]: newLocation
    }));
  };

  const filteredAssignments = React.useMemo(() => {
    if (!searchTerm.trim()) return assignments;
    const searchLower = searchTerm.toLowerCase().trim();
    return assignments.filter(assignment => {
      if (assignment.soldier_name?.toLowerCase().includes(searchLower)) return true;
      const equipmentType = equipmentTypes.find(type => type.id === assignment.equipment_type_id);
      if (equipmentType) {
        if (equipmentType.serial_number?.toString().toLowerCase().includes(searchLower)) return true;
        if (equipmentType.name?.toLowerCase().includes(searchLower)) return true;
      }
      return false;
    });
  }, [assignments, equipmentTypes, searchTerm]);

  const updateSoldierDetailsInAssignments = async () => {
    if (!window.confirm("האם אתה בטוח? פעולה זו תתקן שמות חיילים שהתקלקלו.")) return;
    setLoading(true);
    try {
      const allUsers = await User.list();
      const allAssignments = await Equipment.list();
      const emailToUserMap = new Map(allUsers.map(u => [u.email?.toLowerCase().trim(), u]).filter(([email]) => email));
      const updatePromises = [];
      for (const assignment of allAssignments) {
        const user = emailToUserMap.get(assignment.soldier_email?.toLowerCase().trim());
        const emailPrefix = user?.email?.split('@')[0]?.toLowerCase();
        if (user && user.full_name && assignment.soldier_name?.toLowerCase() === emailPrefix) {
          updatePromises.push(Equipment.update(assignment.id, {
            soldier_name: user.full_name,
            soldier_email: user.email,
            soldier_id: user.personal_id || ""
          }));
        }
      }
      await Promise.all(updatePromises);
      alert(updatePromises.length > 0 ? `תוקנו ${updatePromises.length} שמות חיילים.` : "לא נמצאו שמות שדרשו תיקון.");
      loadData();
    } catch (error) {
      console.error("שגיאה בתיקון שמות החיילים:", error);
      alert("שגיאה בתיקון השמות.");
    } finally {
      setLoading(false);
    }
  };

  const cleanupDeletedSoldierAssignments = async () => {
    try {
      const activeUserEmails = new Set((await User.list()).map(u => u.email?.toLowerCase().trim()).filter(Boolean));
      const assignmentsToDelete = assignments.filter(a => a.soldier_email && !activeUserEmails.has(a.soldier_email.toLowerCase().trim()));
      if (assignmentsToDelete.length > 0) {
        const soldierNames = [...new Set(assignmentsToDelete.map(a => a.soldier_name))].join(', ');
        if (window.confirm(`נמצאו שיוכים לחיילים שנמחקו: ${soldierNames}.\nהאם למחוק שיוכים אלו?`)) {
          await Promise.all(assignmentsToDelete.map(a => Equipment.delete(a.id)));
          alert(`נמחקו ${assignmentsToDelete.length} שיוכים.`);
          loadData();
        }
      } else {
        alert("לא נמצאו שיוכים של חיילים שנמחחו.");
      }
    } catch (error) {
      console.error("Error cleaning up assignments:", error);
      alert("שגיאה בניקוי שיוכים.");
    }
  };

  const handleAssignSuccess = () => {
    setShowAssignDialog(false);
    loadData();
  };

  const handleAddEquipmentToSoldier = (soldierName, soldierId, soldierEmail) => {
    const soldier = soldiers.find(s => s.full_name === soldierName);
    setSelectedSoldierForAdd({
      soldierName,
      soldierId: soldier?.personal_id || soldierId,
      soldierEmail: soldier?.email || soldierEmail
    });
    setShowAddToSoldierDialog(true);
  };

  const handleAddToSoldierSuccess = () => {
    setShowAddToSoldierDialog(false);
    setSelectedSoldierForAdd(null);
    loadData();
  };

  const handleDeleteSoldierAssignments = async (soldierName) => {
    if (window.confirm(`האם למחוק את כל הציוד של ${soldierName}?`)) {
      try {
        const soldierAssignments = assignments.filter(a => a.soldier_name === soldierName);
        await Promise.all(soldierAssignments.map(a => Equipment.delete(a.id)));
        loadData();
      } catch (error) {
        console.error("Error deleting assignments:", error);
        alert("שגיאה במחיקת הציוד.");
      }
    }
  };

  const handleShowSoldierDetails = (soldierName) => {
    const soldier = soldiers.find(s => s.full_name === soldierName) || { full_name: soldierName };
    setSelectedSoldierForDetails(soldier);
    setShowSoldierDetailsDialog(true);
  };

  const handleTransferEquipment = (equipment) => {
    setSelectedEquipmentForTransfer(equipment);
    setShowTransferDialog(true);
  };

  const handleTransferComplete = () => {
    setShowTransferDialog(false);
    setSelectedEquipmentForTransfer(null);
    loadData();
  };

  const generateSoldierToken = async (soldierName, soldierEmail, type = "daily_confirmation", metadata = null, soldierId = null) => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);
    
    await SoldierToken.create({
      company_id: currentCompany.id,
      soldier_name: soldierName,
      soldier_email: soldierEmail,
      soldier_id: soldierId || '',
      token: token,
      token_type: type,
      expires_at: expiresAt.toISOString(),
      used: false,
      metadata: metadata ? JSON.stringify(metadata) : null
    });
    
    return token;
  };

  // פונקציה מרכזית לשליחת מייל עם גיבוי
  const sendEmailWithFallback = async (to, subject, body, from_name = "מערכת ניהול ציוד", settings = {}) => {
    console.log("=== START EMAIL SENDING PROCESS (with passed settings) ===");
    console.log("Received settings for decision:", settings);
    
    const useGmailFunction = settings.default_communication_method === 'gmail';
    console.log("Decision: Should use Gmail function?", useGmailFunction);

    if (useGmailFunction) {
      try {
        console.log("=== TRYING GMAIL FUNCTION ===");
        console.log("About to call sendEmailHandler with:", { to, subject, body, from_name, auth_token: settings.gmail_auth_token });
        
        // ניסיון ראשון: פונקציית מייל גוגל
        const response = await sendEmailHandler({
          to: to,
          subject: subject,
          body: body,
          from_name: from_name,
          auth_token: settings.gmail_auth_token // Added auth_token as per change request
        });
        
        console.log("sendEmailHandler response:", response);
        
        // בדיקה נכונה של התגובה
        if (response && response.data && response.data.success) {
          console.log(`✅ Email sent successfully via Gmail function to ${to}`);
          return;
        } else {
          // אם התגובה לא מצביעה על הצלחה, נפול לגיבוי
          console.log("Gmail function response indicates failure, falling back to built-in email");
          throw new Error("Gmail function returned unsuccessful response");
        }
        
      } catch (gmailError) {
        console.error(`❌ Gmail function failed for ${to}:`, gmailError);
        console.log("Error details:", gmailError.message, gmailError.stack);
        console.log("=== FALLING BACK TO BUILT-IN EMAIL ===");
        // נפל לגיבוי
      }
    } else {
      console.log("=== USING BUILT-IN EMAIL (not Gmail function) ===");
    }

    // גיבוי או שיטה ראשית: אינטגרציה מובנית
    try {
      await SendEmail({
        to: to,
        subject: subject,
        body: body,
        from_name: from_name
      });
      console.log(`✅ Email sent successfully via built-in integration to ${to}`);
    } catch (builtInError) {
      console.error(`❌ Both Gmail function and built-in email failed for ${to}:`, builtInError);
      throw new Error(`כשל בשליחת מייל: ${builtInError.message}`);
    }
    
    console.log("=== END EMAIL SENDING PROCESS ===");
  };

  const sendConfirmationRequest = async (soldierName, soldierEmail, soldierPhone, method, soldierId, settings) => {
    console.log("=== SEND CONFIRMATION REQUEST ===");
    console.log("Soldier:", soldierName);
    console.log("Email:", soldierEmail);
    console.log("Method:", method);
    
    try {
      const token = await generateSoldierToken(soldierName, soldierEmail, "daily_confirmation", null, soldierId);
      
      const now = new Date();
      const formattedDate = now.toLocaleDateString('he-IL') + " " + now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const confirmationUrl = `${window.location.origin}/DailyConfirmation?token=${token}`;

      if (method === 'email' || method === 'gmail') {
          console.log("=== SENDING EMAIL CONFIRMATION ===");
          const emailBody = `שלום ${soldierName},\n\nזוהי בקשה לאישור ציוד יומי.\n\nאנא לחץ על הקישור הבא לאישור הציוד:\n${confirmationUrl}\n\nהקישור תקף ל-48 שעות.\nלא נדרשת התחברות - פשוט לחץ והאשר!\n\nנשלח ב-${formattedDate}.\n\nתודה,\nמערכת ניהול ציוד`;

          await sendEmailWithFallback(soldierEmail, `בקשת אישור ציוד - ${soldierName}`, emailBody, "מערכת ניהול ציוד", settings);
          console.log("✅ EMAIL CONFIRMATION SENT");
      } else if (method === 'sms') {
          console.log("=== SENDING SMS CONFIRMATION ===");
          const smsBody = `שלום ${soldierName}, זוהי בקשה לאישור ציוד. לחץ על הקישור (תקף 48 שעות, ללא צורך בהתחברות): ${confirmationUrl}`;
          
          try {
            await sendSms({ phoneNumber: soldierPhone, message: smsBody });
          } catch (smsError) {
            console.error(`SMS failed for ${soldierName}:`, smsError);
            
            if (soldierEmail && soldierEmail.trim() !== '') {
              const emailBody = `שלום ${soldierName},\n\nזוהי בקשה לאישור ציוד יומי.\n\nניסינו לשלוח לך SMS אך הוא נכשל, לכן שלחנו לך את ההודעה במייל.\n\nאנא לחץ על הקישור הבא לאישור הציוד:\n${confirmationUrl}\n\nהקישור תקף ל-48 שעות.\nלא נדרשת התחברות - פשוט לחץ והאשר!\n\nנשלח ב-${formattedDate}.\n\nתודה,\nמערכת ניהול ציוד`;
              
              try {
                await sendEmailWithFallback(
                  soldierEmail,
                  `בקשת אישור ציוד - ${soldierName} (גיבוי עבור SMS שנכשל)`,
                  emailBody,
                  "מערכת ניהול ציוד",
                  settings
                );
                
                console.log(`SMS failed for ${soldierName}, but email sent successfully as fallback`);
                return;
              } catch (emailError) {
                console.error(`Both SMS and email failed for ${soldierName}:`, { smsError, emailError });
                throw new Error(`SMS נכשל (${smsError.message}) ואימייל הגיבוי גם נכשל (${emailError.message})`);
              }
            } else {
              throw new Error(`SMS נכשל ואין אימייל גיבוי עבור ${soldierName}: ${smsError.message}`);
            }
          }
      }
    } catch (error) {
      console.error("❌ Error sending confirmation request:", error);
      throw error;
    }
  };

  const handleSendSingleConfirmation = async (soldierName, soldierEmail) => {
    console.log("=== HANDLE SEND SINGLE CONFIRMATION ===");
    console.log("Soldier Name:", soldierName);
    console.log("Soldier Email:", soldierEmail);
    
    if (!window.confirm(`האם לשלוח בקשת אישור חדשה ל-${soldierName}? \nפעולה זו תאפס את אישורו היומי הקיים, אם ישנו, ותדרוש ממנו לאשר מחדש.`)) {
        return;
    }
      
    try {
      const [settingsData, users, allSoldiers] = await Promise.all([
          AppSettings.filter({ company_id: currentCompany.id }, null, 1),
          User.list(),
          Soldier.filter({ company_id: currentCompany.id })
      ]);
      const settings = settingsData?.[0] || {};
      let commMethod = settings.default_communication_method || 'email';
      
      console.log("Settings loaded:", settings);
      console.log("Default comm method:", commMethod);

      // Find the specific soldier to check their preference
      const soldierData = allSoldiers.find(s => s.full_name === soldierName);
      console.log("Soldier data:", soldierData);
      
      if (soldierData?.preferred_communication_method && soldierData.preferred_communication_method !== 'default') {
          commMethod = soldierData.preferred_communication_method;
          console.log("Using soldier's preferred method:", commMethod);
      }

      console.log("Final communication method:", commMethod);

      const soldierPhone = soldierData?.phone_number;
      const soldierId = soldierData?.personal_id;
      const effectiveEmail = soldierEmail || soldierData?.email; // Determine effective email

      let confirmationWasReset = false;
      const today = new Date().toISOString().split('T')[0];
      const existingConfirmations = await DailyConfirmationEntity.filter({ company_id: currentCompany.id, soldier_name: soldierName, confirmation_date: today });

      if (existingConfirmations && existingConfirmations.length > 0) {
          await DailyConfirmationEntity.delete(existingConfirmations[0].id);
          confirmationWasReset = true;
      }

      let alertMsg;

      // בדיקה נפרדת לכל שיטת תקשורת
      if (commMethod === 'email') { // מייל מובנה - דורש רישום
          if (!effectiveEmail) throw new Error("לא נמצא מייל לחייל זה.");
          const isRegistered = users.some(u => u.email?.toLowerCase() === effectiveEmail.toLowerCase());
          if (!isRegistered) {
              if (window.confirm(`כדי להשתמש במייל המובנה, המייל ${effectiveEmail} חייב להיות רשום במערכת. יש להזמין את החייל תחילה. האם להזמין?`)) {
                  alert("לחץ על 'workspace' בתפריט הצד, ואז על 'הזמן משתמשים'.");
              }
              return; // עצירת השליחה
          }
          alertMsg = `נשלחה בקשת אישור חדשה במייל (מובנה) ל-${soldierName}.`;
      } else if (commMethod === 'gmail') { // מייל גוגל - לא דורש רישום
          if (!effectiveEmail) throw new Error("לא נמצא מייל לחייל זה.");
          alertMsg = `נשלחה בקשת אישור חדשה במייל (Gmail) ל-${soldierName}.`;
      } else if (commMethod === 'sms') { // SMS
          if (!soldierPhone) throw new Error("לא נמצא מספר טלפון לחייל זה.");
          alertMsg = `נשלחה בקשת אישור חדשה ב-SMS ל-${soldierName}.`;
      }
      
      await sendConfirmationRequest(soldierName, effectiveEmail, soldierPhone, commMethod, soldierId, settings);
      
      // עדכון המנהל
      if (confirmationWasReset) {
          alert(`${alertMsg}\nהאישור היומי הקודם של החייל אופס.`);
      } else {
          alert(alertMsg);
      }
      
      loadData();

    } catch (error) {
      console.error("Error sending confirmation:", error);
      alert(`שגיאה בשליחת הבקשה ל-${soldierName}: ${error.message}`);
    }
  };

  const handleSendConfirmationToAll = async () => {
    if (!window.confirm("האם לשלוח בקשת אישור לכל החיילים?")) return;
    setLoading(true);
    const results = { email: 0, gmail: 0, sms: 0, unreachable: 0, error: 0 };
    const unreachableSoldiers = [];

    try {
        const [allUsers, soldierDataList, settingsData] = await Promise.all([
            User.list(),
            Soldier.filter({ company_id: currentCompany.id }),
            AppSettings.filter({ company_id: currentCompany.id }, null, 1)
        ]);

        const settings = settingsData?.[0] || {};
        const defaultCommMethod = settings.default_communication_method || 'email';

        const registeredEmails = new Set(allUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
        
        const soldierGroups = assignments.reduce((acc, assignment) => {
            if (assignment?.soldier_name) {
                (acc[assignment.soldier_name] = acc[assignment.soldier_name] || []).push(assignment);
            }
            return acc;
        }, {});
        
        const soldierDataMap = new Map(soldierDataList.map(s => [s.full_name, s]));

        const soldierNames = Object.keys(soldierGroups);
        if (soldierNames.length === 0) {
            alert("אין חיילים עם ציוד במערכת.");
            setLoading(false);
            return;
        }

        for (const name of soldierNames) {
            const soldierInfo = soldierDataMap.get(name);

            let commMethod = defaultCommMethod;
            if (soldierInfo?.preferred_communication_method && soldierInfo.preferred_communication_method !== 'default') {
                commMethod = soldierInfo.preferred_communication_method;
            }

            const soldierEmail = soldierInfo?.email;
            const soldierPhone = soldierInfo?.phone_number;
            const soldierId = soldierInfo?.personal_id;

            // בדיקת תקינות פרטי התקשורת לפי השיטה
            if (commMethod === 'email') {
                if (!soldierEmail) {
                    results.unreachable++;
                    unreachableSoldiers.push(`${name} (אין מייל)`);
                    continue;
                }
                if (!registeredEmails.has(soldierEmail.toLowerCase())) {
                    results.unreachable++;
                    unreachableSoldiers.push(`${name} (${soldierEmail} - לא רשום)`);
                    continue;
                }
            } else if (commMethod === 'gmail') {
                if (!soldierEmail) {
                    results.unreachable++;
                    unreachableSoldiers.push(`${name} (אין מייל)`);
                    continue;
                }
            } else if (commMethod === 'sms') {
                if (!soldierPhone) {
                    results.unreachable++;
                    unreachableSoldiers.push(`${name} (אין טלפון)`);
                    continue;
                }
            }

            try {
                await sendConfirmationRequest(name, soldierEmail, soldierPhone, commMethod, soldierId, settings);
                if (commMethod === 'gmail') results.gmail++;
                else if (commMethod === 'email') results.email++;
                else results.sms++;
            } catch (error) {
                console.error(`Failed to send to ${name}:`, error);
                results.error++;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        let message = "התוצאות:";
        if (results.email > 0) message += `\n• מייל (מובנה): ${results.email}`;
        if (results.gmail > 0) message += `\n• מייל גוגל: ${results.gmail}`;
        if (results.sms > 0) message += `\n• SMS: ${results.sms}`;
        if (results.unreachable > 0) message += `\n• לא נשלח: ${results.unreachable} (${unreachableSoldiers.join(', ')})`;
        if (results.error > 0) message += `\n• שגיאות: ${results.error}`;
        if (unreachableSoldiers.some(s => s.includes('לא רשום'))) message += "\n\nכדי להזמין חיילים, לחץ על 'workspace' > 'הזמן משתמשים'.";

        alert(message);
    } catch (error) {
        console.error("Error in handleSendConfirmationToAll:", error);
        alert("שגיאה כללית בשליחת הבקשות.");
    } finally {
        setLoading(false);
    }
  };

  const exportData = () => {
    const typesMap = new Map(equipmentTypes.map(type => [type.id, type]));
    
    const assignmentsToExport = assignments.filter(assignment => {
      const type = typesMap.get(assignment.equipment_type_id);
      return type && type.serial_number;
    });

    if (assignmentsToExport.length === 0) {
      alert("אין ציוד עם מספר צ' לייצוא.");
      return;
    }

    const exportRows = assignmentsToExport.map(item => {
      const type = typesMap.get(item.equipment_type_id) || {};
      return {
        'שם ציוד': type.name || 'לא ידוע',
        'צ\' של הציוד': type.serial_number || 'אין',
        'שם חייל': item.soldier_name || '',
        'מקום': item.location || '',
        'אישור אחרון': item.last_confirmation_date || 'לא אושר',
        'סטטוס': item.status || 'active'
      };
    });

    const headers = Object.keys(exportRows[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportRows.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `equipment_assignments_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">ניהול שיוכי ציוד</h1>
            <p className="text-slate-600">שיוך וניהול ציוד לחיילים</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button 
              variant="outline" 
              onClick={exportData}
              disabled={
                assignments.filter(a => {
                  const type = equipmentTypes.find(t => t.id === a.equipment_type_id);
                  return type && type.serial_number;
                }).length === 0
              }
              className="flex-1 md:flex-none"
            >
              <Download className="w-4 h-4 mr-2" />
              יצוא ({assignments.filter(a => {
                const type = equipmentTypes.find(t => t.id === a.equipment_type_id);
                return type && type.serial_number;
              }).length})
            </Button>
            <Button 
              variant="outline"
              onClick={handleSendConfirmationToAll}
              disabled={assignments.length === 0 || loading}
              className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <Mail className="w-4 h-4 mr-2" />
              {loading ? "שולח..." : "אישור מחודש לכולם"}
            </Button>
            <Button 
              variant="outline"
              onClick={updateSoldierDetailsInAssignments}
              disabled={loading}
              className="flex-1 md:flex-none bg-green-50 hover-bg-green-100 text-green-700 border-green-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              תקן שמות
            </Button>
            <Button 
              variant="outline"
              onClick={cleanupDeletedSoldierAssignments}
              disabled={assignments.length === 0 || loading}
              className="flex-1 md:flex-none bg-red-50 hover-bg-red-100 text-red-700 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              נקה שיוכים
            </Button>
            <Button 
              onClick={() => setShowAssignDialog(true)}
              className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              שייך ציוד
            </Button>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-800">
              סיכום שיוכים
            </CardTitle>
            <div className="mt-4">
              <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="חפש לפי שם חייל, מספר צ' או שם ציוד..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              {searchTerm && (
                <p className="text-sm text-slate-600 mt-2">
                  מציג {filteredAssignments.length} תוצאות מתוך {assignments.length} שיוכים
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">טוען נתונים...</p>
                <p className="text-xs text-slate-400 mt-2">אם הטעינה נמשכת זמן רב, נסה לרענן את הדף</p>
              </div>
            ) : assignments.length === 0 && equipmentTypes.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-yellow-600 mb-4 text-5xl">⚠️</div>
                <h3 className="lg font-semibold text-slate-600 mb-2">לא נמצאו נתונים</h3>
                <p className="text-slate-500 mb-4">יתכן שיש בעיית חיבור או שטרם נוספו נתונים למערכת</p>
                <Button onClick={loadData} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  נסה שוב
                </Button>
              </div>
            ) : (
              <AssignmentsTable
                assignments={filteredAssignments}
                equipmentTypes={equipmentTypes}
                onDeleteSoldierAssignments={handleDeleteSoldierAssignments}
                onAddEquipmentToSoldier={handleAddEquipmentToSoldier}
                onSendConfirmationRequest={handleSendSingleConfirmation}
                onShowSoldierDetails={handleShowSoldierDetails}
                onRefreshData={loadData}
                onTransferEquipment={handleTransferEquipment}
                locationUpdates={locationUpdates}
                onLocationChange={handleLocationChange}
                setLocationUpdates={setLocationUpdates}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AssignEquipmentDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        soldiers={soldiers}
        equipmentTypes={equipmentTypes}
        assignments={assignments}
        onAssignSuccess={handleAssignSuccess}
      />

      {selectedSoldierForAdd && (
        <AddToSoldierDialog
          open={showAddToSoldierDialog}
          onOpenChange={setShowAddToSoldierDialog}
          soldierName={selectedSoldierForAdd.soldierName}
          soldierId={selectedSoldierForAdd.soldierId}
          soldierEmail={selectedSoldierForAdd.soldierEmail}
          equipmentTypes={equipmentTypes}
          assignments={assignments}
          onAssignSuccess={handleAddToSoldierSuccess}
        />
      )}

      {selectedSoldierForDetails && (
        <SoldierEquipmentDetailsDialog
          open={showSoldierDetailsDialog}
          onOpenChange={setShowSoldierDetailsDialog}
          soldier={selectedSoldierForDetails}
          allEquipmentTypes={equipmentTypes}
          allAssignments={assignments}
          onRefreshData={loadData}
        />
      )}

      {selectedEquipmentForTransfer && (
        <TransferEquipmentDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          equipment={selectedEquipmentForTransfer}
          onTransferComplete={handleTransferComplete}
        />
      )}
    </div>
  );
}