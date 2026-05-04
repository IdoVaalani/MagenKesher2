import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { Soldier } from "@/entities/Soldier";
import { DailyConfirmation } from "@/entities/DailyConfirmation";
import { EquipmentSignature } from "@/entities/EquipmentSignature";
import { SoldierToken } from "@/entities/SoldierToken";
import { AppSettings } from "@/entities/AppSettings";
import { SystemLog } from "@/entities/SystemLog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, Package, CheckCircle, AlertCircle, Mail, Clock, Shield, Activity, UserCheck, FileWarning, ShieldAlert } from "lucide-react";
import { sendEmailHandler } from "@/functions/sendEmailHandler";
import { sendSms } from "@/functions/sendSms";

import StatsCards from "../components/dashboard/StatsCards";
import ConfirmationStatus from "../components/dashboard/ConfirmationStatus";
import SoldiersList from "../components/dashboard/SoldiersList";
import ManualConfirmationDialog from "../components/dashboard/ManualConfirmationDialog";
import ReminderConfirmationDialog from "../components/dashboard/ReminderConfirmationDialog";
import OpenReports from "../components/dashboard/OpenReports";
import PartialConfirmationDialog from "../components/dashboard/PartialConfirmationDialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

// Helper function for safely formatting date strings
const safeFormatDate = (dateString) => {
    if (!dateString) return 'לא זמין';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString('he-IL');
    } catch (e) {
        return dateString;
    }
};

const DetailsDialog = ({ open, onOpenChange, dialogData, dialogType }) => {
  const getTitle = () => {
    switch (dialogType) {
      case 'soldiers': return 'פרטי חיילים עם ציוד';
      case 'equipment': return 'פרטי ציוד פעיל';
      case 'confirmed': return 'חיילים שאישרו היום';
      case 'pending': return 'חיילים הממתינים לאישור';
      case 'unconfirmed_serial': return 'מכשירי צ\' שטרם אושרו';
      case 'reports': return 'פניות פתוחות';
      default: return 'פרטים';
    }
  };

  const renderContent = () => {
    if (!dialogData || dialogData.length === 0) {
      return <p className="text-center py-4">אין נתונים להצגה.</p>;
    }

    switch (dialogType) {
      case 'soldiers':
        return (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם חייל</TableHead>
                  <TableHead>אישור</TableHead>
                  <TableHead>פריטי ציוד</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((item, index) => (
                  <TableRow key={item.name || index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={item.confirmed ? "success" : (item.partiallyConfirmed ? "warning" : "destructive")}>
                        {item.confirmed ? 'אישר הכל' : (item.partiallyConfirmed ? 'אישור חלקי' : 'ממתין')}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.equipmentCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );
      case 'equipment':
        return (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם ציוד</TableHead>
                  <TableHead>חייל</TableHead>
                  <TableHead>מיקום</TableHead>
                  <TableHead>מספר סידורי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.soldierName || 'לא משויך'}</TableCell>
                    <TableCell>{item.location || 'לא מוגדר'}</TableCell>
                    <TableCell>{item.serialNumber}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );
      case 'confirmed':
        return (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם חייל</TableHead>
                  <TableHead>זמן אישור</TableHead>
                  <TableHead>דיווח?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((item, index) => (
                  <TableRow key={item.name || index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.confirmationTime || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={item.hasReport ? "warning" : "default"}>
                        {item.hasReport ? 'כן' : 'לא'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );
      case 'pending':
        return (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם חייל</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>טלפון</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((item, index) => (
                  <TableRow key={item.name || index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.email || 'אין אימייל'}</TableCell>
                    <TableCell>{item.phone || 'אין טלפון'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );
      case 'unconfirmed_serial':
        return (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם מכשיר</TableHead>
                  <TableHead>מספר צ'</TableHead>
                  <TableHead>חייל</TableHead>
                  <TableHead>מיקום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-bold text-red-600">{item.serialNumber}</TableCell>
                    <TableCell>{item.soldierName || 'לא משויך'}</TableCell>
                    <TableCell>{item.location || 'לא מוגדר'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );
      case 'reports':
        return (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם חייל</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>פרטי דיווח</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.soldier_name}</TableCell>
                    <TableCell>{safeFormatDate(item.confirmation_date)}</TableCell>
                    <TableCell>{item.report_details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[80vh] sm:h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {dialogType === 'soldiers' && 'רשימת כל החיילים עם ציוד הדורש אישור יומי.'}
            {dialogType === 'equipment' && 'רשימת כל פריטי הציוד הפעילים הדורשים אישור יומי.'}
            {dialogType === 'confirmed' && 'חיילים שאישרו את הציוד שלהם היום.'}
            {dialogType === 'pending' && 'חיילים שטרם אישרו את הציוד שלהם היום.'}
            {dialogType === 'unconfirmed_serial' && 'מכשירים עם מספר צ\' שטרם אושרו על ידי החיילים היום.'}
            {dialogType === 'reports' && 'דיווחים פתוחים שממתינים לטיפול.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};


export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSoldiers: 0,
    totalEquipment: 0,
    confirmed: 0,
    pending: 0,
    confirmationRate: 0,
    soldierNames: [],
    unconfirmedSerial: 0,
    lastUpdate: null
  });
  
  const [confirmationData, setConfirmationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showManualConfirmationDialog, setShowManualConfirmationDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [pendingNames, setPendingNames] = useState([]);
  const [openReports, setOpenReports] = useState([]);
  const [allSoldiers, setAllSoldiers] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState(null);
  const [dialogData, setDialogData] = useState(null);

  const [showPartialConfirmationDialog, setShowPartialConfirmationDialog] = useState(false);
  const [selectedPartialSoldier, setSelectedPartialSoldier] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const generateSoldierToken = async (soldierName, soldierEmail, type = "daily_confirmation", metadata = null, soldierId = null) => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);
    
    await SoldierToken.create({
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const [
        allEquipment,
        todayConfirmations,
        soldiersList,
        allOpenReports,
        allEquipmentTypes,
        todaySignatures
      ] = await Promise.all([
        Equipment.filter({ status: 'active' }),
        DailyConfirmation.filter({ confirmation_date: today }),
        Soldier.list(),
        DailyConfirmation.filter({ report_handled: false }),
        EquipmentType.list(),
        EquipmentSignature.filter({ signature_date: today, status: 'active' })
      ]);

      // Build a set of soldiers who signed equipment today
      const soldiersWhoSignedToday = new Set(
        todaySignatures.map(sig => sig.soldier_name).filter(Boolean)
      );
      
      setAllSoldiers(soldiersList);
      
      const filteredReports = allOpenReports.filter(r => 
        r.report_details && 
        r.report_details.trim() !== '' && 
        r.report_details.trim() !== 'אישור ידני על ידי מנהל'
      );
      setOpenReports(filteredReports);

      const equipmentRequiringConfirmation = allEquipment.filter(eq => eq.requires_soldier_confirmation);
      const equipmentCountBySoldier = equipmentRequiringConfirmation.reduce((acc, eq) => {
        if (eq.soldier_name) {
            const count = (acc[eq.soldier_name] || 0) + 1;
            acc[eq.soldier_name] = count;
        }
        return acc;
      }, {});
      
      const soldierNames = Object.keys(equipmentCountBySoldier);
      const todayConfirmationsMap = new Map(todayConfirmations.map(conf => [conf.soldier_name, conf]));

      let liveConfirmedCount = 0;
      for (const name of soldierNames) {
        const totalItems = equipmentCountBySoldier[name] || 0;
        const confRecord = todayConfirmationsMap.get(name);
        const confirmedItems = confRecord?.equipment_ids?.length || 0;
        
        const isFullyConfirmed = confRecord?.is_complete_confirmation === true || 
                                 (totalItems > 0 && confirmedItems === totalItems) ||
                                 soldiersWhoSignedToday.has(name);
        
        if (isFullyConfirmed) {
            liveConfirmedCount++;
        }
      }

      let unconfirmedSerialCount = 0;
      const equipmentTypesMap = new Map(allEquipmentTypes.map(type => [type.id, type]));
      
      const serialNumberedEquipment = equipmentRequiringConfirmation.filter(eq => {
          const type = equipmentTypesMap.get(eq.equipment_type_id);
          return type && type.serial_number;
      });

      const confirmedEquipmentIdsBySoldier = new Map();
      todayConfirmations.forEach(conf => {
          if (conf.equipment_ids && conf.soldier_name) {
              confirmedEquipmentIdsBySoldier.set(conf.soldier_name, new Set(conf.equipment_ids));
          }
      });

      for (const eq of serialNumberedEquipment) {
          // If this soldier signed today, all their equipment counts as confirmed
          if (soldiersWhoSignedToday.has(eq.soldier_name)) continue;
          
          const soldierConfirmedEquipmentIds = confirmedEquipmentIdsBySoldier.get(eq.soldier_name);
          if (!soldierConfirmedEquipmentIds || !soldierConfirmedEquipmentIds.has(eq.id)) {
              unconfirmedSerialCount++;
          }
      }

      const confirmed = liveConfirmedCount;
      const pending = soldierNames.length - confirmed;
      const confirmationRate = soldierNames.length > 0 ? Math.round((confirmed / soldierNames.length) * 100) : 100;

      setStats({
        totalSoldiers: soldierNames.length,
        totalEquipment: equipmentRequiringConfirmation.length,
        confirmed,
        pending,
        confirmationRate,
        soldierNames,
        unconfirmedSerial: unconfirmedSerialCount,
        lastUpdate: new Date().toLocaleTimeString('he-IL')
      });

      const confirmationsByName = soldierNames.map(name => {
        const confirmationRecord = todayConfirmationsMap.get(name);
        const totalItems = equipmentCountBySoldier[name] || 0;
        const confirmedItemsCount = confirmationRecord?.equipment_ids?.length || 0;
        const signedToday = soldiersWhoSignedToday.has(name);

        const isFullyConfirmed = confirmationRecord?.is_complete_confirmation === true || 
                                 (totalItems > 0 && confirmedItemsCount === totalItems) ||
                                 signedToday;
        const hasPartialConfirmation = !signedToday && confirmationRecord && 
                                       !isFullyConfirmed && 
                                       confirmedItemsCount > 0 && 
                                       confirmationRecord.is_complete_confirmation !== true;
        
        const soldierInfo = soldiersList.find(s => s.full_name === name);
        
        // Find signature time if signed today
        const signatureRecord = signedToday ? todaySignatures.find(s => s.soldier_name === name) : null;
        
        return {
          soldierName: name,
          confirmed: isFullyConfirmed,
          partiallyConfirmed: hasPartialConfirmation,
          confirmationTime: confirmationRecord?.confirmation_time || (signedToday ? signatureRecord?.signature_time : null),
          reportDetails: confirmationRecord?.report_details || null,
          soldierEmail: soldierInfo?.email || '',
          soldierPhone: soldierInfo?.phone_number || '',
          soldierId: soldierInfo?.id || '',
          signedToday: signedToday
        };
      });

      setConfirmationData(confirmationsByName);
      setPendingNames(confirmationsByName.filter(item => !item.confirmed).map(item => item.soldierName));
      
      await SystemLog.create({
        message: `נתוני לוח הבקרה נטעו: ${soldierNames.length} חיילים, ${confirmed} אישרו במלואו, ${pending} ממתינים.`,
        level: 'info',
        category: 'data'
      });

    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("שגיאה בטעינת נתונים");
      await SystemLog.create({
        message: `שגיאה בטעינת נתוני לוח הבקרה: ${err.message}`,
        level: 'error',
        category: 'data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const sendConfirmationRequest = async (soldierName, soldierEmail, soldierPhone, method, soldierId) => {
    try {
      const token = await generateSoldierToken(soldierName, soldierEmail, "daily_confirmation", null, soldierId);
      
      const now = new Date();
      const formattedDate = now.toLocaleDateString('he-IL') + " " + now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const confirmationUrl = `${window.location.origin}/DailyConfirmation?token=${token}`;

      if ((method === 'email' || method === 'gmail') && soldierEmail) {
        const emailBody = `שלום ${soldierName},\n\nזוהי בקשה לאישור ציוד יומי.\n\nאנא לחץ על הקישור הבא לאישור הציוד:\n${confirmationUrl}\n\nהקישור תקף ל-48 שעות.\nלא נדרשת התחברות - פשוט לחץ והאשר!\n\nנשלח ב-${formattedDate}.\n\nתודה,\nמערכת ניהול ציוד`;

        await sendEmailHandler({
          to: soldierEmail,
          subject: `בקשת אישור ציוד - ${soldierName}`,
          body: emailBody,
          from_name: "מערכת ניהול ציוד"
        });
      } else if (method === 'sms' && soldierPhone) {
        const smsMessage = `שלום ${soldierName}, זוהי בקשה לאישור ציוד. לחץ על הקישור (תקף 48 שעות, ללא צורך בהתחברות): ${confirmationUrl}`;
        
        try {
          await sendSms({ phoneNumber: soldierPhone, message: smsMessage });
          await SystemLog.create({
            message: `בקשת אישור SMS נשלחה בהצלחה ל-${soldierName} (${soldierPhone}).`,
            level: 'info',
            category: 'communication'
          });
        } catch (smsError) {
          console.error(`SMS failed for ${soldierName}:`, smsError);
          await SystemLog.create({
            message: `כשל בשליחת SMS ל-${soldierName} (${soldierPhone}): ${smsError.message}`,
            level: 'error',
            category: 'communication'
          });
          
          if (soldierEmail && soldierEmail.trim() !== '') {
            const emailBody = `שלום ${soldierName},\n\nזוהי בקשה לאישור ציוד יומי.\n\nניסינו לשלוח לך SMS אך הוא נכשל, לכן שלחנו לך את ההודעה במייל.\n\nאנא לחץ על הקישור הבא לאישור הציוד:\n${confirmationUrl}\n\nהקישור תקף ל-48 שעות.\nלא נדרשת התחברות - פשוט לחץ והאשר!\n\nנשלח ב-${formattedDate}.\n\nתודה,\nמערכת ניהול ציוד`;
            
            try {
              await sendEmailHandler({
                to: soldierEmail,
                subject: `בקשת אישור ציוד - ${soldierName} (גיבוי עבור SMS שנכשל)`,
                body: emailBody,
                from_name: "מערכת ניהול ציוד"
              });
              
              console.log(`SMS failed for ${soldierName}, but email sent successfully as fallback`);
              await SystemLog.create({
                message: `SMS נכשל עבור ${soldierName}, אך מייל גיבוי נשלח בהצלחה ל-${soldierEmail}.`,
                level: 'info',
                category: 'communication'
              });
              return;
            } catch (emailError) {
              console.error(`Both SMS and email failed for ${soldierName}:`, { smsError, emailError });
              await SystemLog.create({
                message: `גם SMS וגם מייל גיבוי נכשלו עבור ${soldierName}: SMS: ${smsError.message}, Email: ${emailError.message}`,
                level: 'error',
                category: 'communication'
              });
              throw new Error(`SMS נכשל (${smsError.message}) ואימייל הגיבוי גם נכשל (${emailError.message})`);
            }
          } else {
            await SystemLog.create({
              message: `SMS נכשל עבור ${soldierName}, ואין אימייל גיבוי זמין. שגיאת SMS: ${smsError.message}`,
              level: 'warning',
              category: 'communication'
            });
            throw new Error(`SMS נכשל ואין אימייל גיבוי עבור ${soldierName}: ${smsError.message}`);
          }
        }
      }
    } catch (error) {
      console.error("Error sending confirmation request:", error);
      throw error;
    }
  };
  
  const handleMarkReportAsHandled = async (report) => {
    if (!window.confirm(`האם אתה בטוח שברצונך לסמן את הפנייה של ${report.soldier_name} כטופלה?`)) return;
    
    setIsSending(true);
    try {
        const soldier = allSoldiers.find(s => s.full_name === report.soldier_name);
        
        if (!soldier || !soldier.email) {
            throw new Error(`לא נמצא מייל עבור החייל: ${report.soldier_name}. אנא וודא שהמייל שלו מוגדר בטבלת החיילים.`);
        }

        await DailyConfirmation.update(report.id, { report_handled: true });

        const emailBody = `שלום ${report.soldier_name},\n\nהפנייה שלך בנושא:\n"${report.report_details}"\n\nטופלה על ידי המנהל.\n\nתודה,\nמערכת ניהול ציוד`;
        
        await sendEmailHandler({
            to: soldier.email,
            subject: 'עדכון סטטוס פנייה: פנייתך טופלה',
            body: emailBody,
            from_name: "מערכת ניהול ציוד"
        });

        await SystemLog.create({
            message: `הפנייה של ${report.soldier_name} סומנה כטופלה ונשלח מייל עדכון ל-${soldier.email}.`,
            level: 'info',
            category: 'report'
        });

        await loadDashboardData();

    } catch (error) {
        console.error("Error marking report as handled:", error);
        alert(`שגיאה בטיפול בפנייה: ${error.message}`);
        await SystemLog.create({
            message: `שגיאה בטיפול בפנייה של ${report.soldier_name}: ${error.message}`,
            level: 'error',
            category: 'report'
        });
    } finally {
        setIsSending(false);
    }
  };


  const sendMassConfirmation = async (targetSoldiers, isReminder = false) => {
    const actionText = isReminder ? 'תזכורות' : 'בקשות אישור';
    if (!window.confirm(`האם לשלוח ${actionText} ל-${targetSoldiers.length} חיילים?`)) return;

    setIsSending(true);

    await SystemLog.create({
      message: `התחלת שליחת ${actionText} ל-${targetSoldiers.length} חיילים.`,
      level: 'info',
      category: 'communication'
    });

    try {
      const [allUsers, soldierDataList, settingsData] = await Promise.all([
        User.list(),
        Soldier.list(),
        AppSettings.list(null, 1)
      ]);

      const settings = settingsData?.[0] || {};
      const defaultCommMethod = settings.default_communication_method || 'email';
      
      const registeredEmails = new Set(allUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
      const soldierDataMap = new Map(soldierDataList.map(s => [s.full_name, s]));
      
      if (targetSoldiers.length === 0) {
        alert("אין חיילים לשליחה.");
        setIsSending(false);
        return;
      }

      const results = { email: 0, sms: 0, unreachable: 0, error: 0 };
      const unreachableSoldiers = [];

      for (const name of targetSoldiers) {
        const soldierInfo = soldierDataMap.get(name);
        
        let commMethod = defaultCommMethod;
        if (soldierInfo?.preferred_communication_method && soldierInfo.preferred_communication_method !== 'default') {
            commMethod = soldierInfo.preferred_communication_method;
        }
        
        const soldierEmail = soldierInfo?.email;
        const soldierPhone = soldierInfo?.phone_number;
        const soldierId = soldierInfo?.id;

        if ((commMethod === 'email' || commMethod === 'gmail') && !soldierEmail) {
          results.unreachable++;
          unreachableSoldiers.push(`${name} (אין מייל)`);
          continue;
        }
        if (commMethod === 'sms' && !soldierPhone) {
          results.unreachable++;
          unreachableSoldiers.push(`${name} (אין טלפון)`);
          continue;
        }

        if (commMethod === 'email' && soldierEmail && !registeredEmails.has(soldierEmail.toLowerCase())) {
          results.unreachable++;
          unreachableSoldiers.push(`${name} (${soldierEmail} - לא רשום)`);
          await SystemLog.create({
            message: `דלוג שליחת ${actionText} לחייל ${name}: המייל לא רשום (נדרש עבור שיטת 'email' המובנית).`,
            level: 'warning',
            category: 'communication'
          });
          continue;
        }

        try {
          await sendConfirmationRequest(name, soldierEmail, soldierPhone, commMethod, soldierId);
          if (commMethod === 'email' || commMethod === 'gmail') {
            results.email++;
          } else if (commMethod === 'sms') {
            results.sms++;
          }
        } catch (error) {
          console.error(`Failed to send to ${name}:`, error);
          results.error++;
          await SystemLog.create({
            message: `כשל בשליחה ל-${name}: ${error.message}`,
            level: 'error',
            category: 'communication'
          });
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      let message = `${actionText} נשלחו:`;
      if (results.email > 0) message += `\n• מייל: ${results.email}`;
      if (results.sms > 0) message += `\n• SMS: ${results.sms}`;
      if (results.unreachable > 0) message += `\n• לא נשלח: ${results.unreachable} (${unreachableSoldiers.join(', ')})`;
      if (results.error > 0) message += `\n• שגיאות: ${results.error}`;
      if (unreachableSoldiers.some(s => s.includes('לא רשום'))) message += "\n\nכדי להזמין חיילים, לחץ על 'workspace' > 'הזמן משתמשים'.";

      alert(message);

      await SystemLog.create({
        message: `סיכום שליחת ${actionText}: ${results.email} מיילים, ${results.sms} SMS, ${results.unreachable} לא נשלח, ${results.error} שגיאות.`,
        level: 'info',
        category: 'communication'
      });

    } catch (error) {
      console.error(`Error in sendMassConfirmation:`, error);
      alert(`שגיאה כללית בשליחת ה${actionText}.`);
      await SystemLog.create({
        message: `שגיאה כללית בשליחת ${actionText}: ${error.message}`,
        level: 'error',
        category: 'communication'
      });
    } finally {
      setIsSending(false);
      loadDashboardData();
    }
  };

  const sendConfirmationRequestToAll = () => {
    const targetSoldiers = stats.confirmed === 0 ? stats.soldierNames : pendingNames;
    sendMassConfirmation(targetSoldiers, stats.confirmed > 0);
  };
  
  const handleSendReminders = () => {
    sendMassConfirmation(pendingNames, true);
  }

  const handleCardClick = async (cardType) => {
    setDialogType(cardType);
    setDialogData([]);
    
    try {
      switch (cardType) {
        case 'soldiers':
          const allEquipmentForSoldiers = await Equipment.filter({ requires_soldier_confirmation: true, status: 'active' });
          const today = new Date().toISOString().split('T')[0];
          const todayConfirmations = await DailyConfirmation.filter({ confirmation_date: today });

          const equipmentCounts = allEquipmentForSoldiers.reduce((acc, eq) => {
            if (eq.soldier_name) {
                acc[eq.soldier_name] = (acc[eq.soldier_name] || 0) + 1;
            }
            return acc;
          }, {});

          const todayConfirmationsMap = new Map(todayConfirmations.map(conf => [conf.soldier_name, conf]));

          const soldiersData = stats.soldierNames.map(soldierName => {
            const confirmationRecord = todayConfirmationsMap.get(soldierName);
            const totalItems = equipmentCounts[soldierName] || 0;
            const confirmedItemsCount = confirmationRecord?.equipment_ids?.length || 0;

            const isFullyConfirmed = confirmationRecord?.is_complete_confirmation === true || (totalItems > 0 && confirmedItemsCount === totalItems);
            const hasPartialConfirmation = confirmationRecord && !isFullyConfirmed && confirmedItemsCount > 0 && confirmationRecord.is_complete_confirmation !== true;

            return {
              name: soldierName,
              equipmentCount: totalItems,
              confirmed: isFullyConfirmed,
              partiallyConfirmed: hasPartialConfirmation
            };
          });
          setDialogData(soldiersData);
          break;

        case 'equipment':
          const allEquipment = await Equipment.filter({ 
            requires_soldier_confirmation: true, 
            status: 'active' 
          });
          const allTypes = await EquipmentType.list();
          const typesMap = new Map(allTypes.map(t => [t.id, t]));
          
          const equipmentData = allEquipment.map(eq => ({
            id: eq.id,
            name: typesMap.get(eq.equipment_type_id)?.name || 'לא ידוע',
            serialNumber: eq.serial_number,
            soldierName: eq.soldier_name,
            location: eq.location
          }));
          setDialogData(equipmentData);
          break;

        case 'confirmed':
          const confirmedData = confirmationData
            .filter(c => c.confirmed)
            .map(c => ({
              name: c.soldierName,
              confirmationTime: c.confirmationTime || 'לא זמין',
              hasReport: !!c.reportDetails
            }));
          setDialogData(confirmedData);
          break;

        case 'pending':
          const allSoldiersForPending = await Soldier.list();
          const soldierMapForPending = new Map(allSoldiersForPending.map(s => [s.full_name, s]));
          
          const pendingData = confirmationData
            .filter(c => !c.confirmed)
            .map(c => {
              const soldierInfo = soldierMapForPending.get(c.soldierName);
              return {
                name: c.soldierName,
                email: soldierInfo?.email,
                phone: soldierInfo?.phone_number
              };
            });
          setDialogData(pendingData);
          break;

        case 'unconfirmed_serial':
          const equipmentWithSerials = await Equipment.filter({ 
              requires_soldier_confirmation: true, 
              status: 'active' 
          });
          const currentToday = new Date().toISOString().split('T')[0];
          const currentTodayConfirmations = await DailyConfirmation.filter({ confirmation_date: currentToday });
          const currentAllTypes = await EquipmentType.list();
          const currentTypesMap = new Map(currentAllTypes.map(t => [t.id, t]));

          const confirmedEquipmentIdsBySoldierForDialog = new Map();
          currentTodayConfirmations.forEach(conf => {
              if (conf.equipment_ids && conf.soldier_name) {
                  confirmedEquipmentIdsBySoldierForDialog.set(conf.soldier_name, new Set(conf.equipment_ids));
              }
          });

          const unconfirmedSerialEquipment = [];
          for (const eq of equipmentWithSerials) {
              const type = currentTypesMap.get(eq.equipment_type_id);
              if (type && type.serial_number) {
                  const soldierConfirmedEquipmentIds = confirmedEquipmentIdsBySoldierForDialog.get(eq.soldier_name);
                  if (!soldierConfirmedEquipmentIds || !soldierConfirmedEquipmentIds.has(eq.id)) {
                      unconfirmedSerialEquipment.push({
                          id: eq.id,
                          name: type.name || 'לא ידוע',
                          serialNumber: eq.serial_number,
                          soldierName: eq.soldier_name || 'לא משויך',
                          location: eq.location || 'לא מוגדר'
                      });
                  }
              }
          }
          setDialogData(unconfirmedSerialEquipment);
          break;

        case 'reports':
          setDialogData(openReports);
          break;
      }
      setDialogOpen(true);
    } catch (error) {
      console.error('Error loading dialog data:', error);
      alert('שגיאה בטעינת נתוני הדיאלוג.');
    }
  };

  const handleSoldierClick = (soldierName) => {
    setSelectedPartialSoldier(soldierName);
    setShowPartialConfirmationDialog(true);
  };

  const handlePartialConfirmationUpdated = () => {
    setShowPartialConfirmationDialog(false);
    setSelectedPartialSoldier(null);
    loadDashboardData();
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-4">שגיאה בטעינת הנתונים</h2>
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={handleRefresh}>נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 mb-4 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-0.5">לוח בקרה</h1>
              <p className="text-slate-600 text-xs sm:text-sm md:text-base">
                עדכון: {stats.lastUpdate}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh} 
              disabled={isRefreshing || isSending}
              className="bg-white hover:bg-slate-50 md:hidden"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh} 
              disabled={isRefreshing || isSending}
              className="bg-white hover:bg-slate-50 hidden md:flex"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'מרענן...' : 'רענן'}
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualConfirmationDialog(true)}
                disabled={isSending}
                className="bg-white hover:bg-slate-50 text-xs sm:text-sm"
            >
                <UserCheck className="w-4 h-4 ml-1 sm:mr-2" />
                אישור ידני
            </Button>
            <Button
              size="sm"
              onClick={sendConfirmationRequestToAll}
              disabled={isSending || stats.totalSoldiers === 0}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 col-span-2 sm:col-span-1 text-xs sm:text-sm"
            >
              <Mail className="w-4 h-4 ml-1 sm:mr-2" />
              {isSending ? 'שולח...' : (stats.confirmed === 0 ? 'שלח אישור לכולם' : 'תזכורת לממתינים')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-8">
          <StatsCards
            title="סה״כ חיילים"
            value={stats.totalSoldiers}
            icon={Users}
            bgColor="bg-blue-500"
            trend="עם ציוד הדורש אישור"
            onClick={() => handleCardClick('soldiers')}
          />
          <StatsCards
            title="פריטי ציוד פעילים"
            value={stats.totalEquipment}
            icon={Package}
            bgColor="bg-green-500"
            trend="הדורשים אישור יומי"
            onClick={() => handleCardClick('equipment')}
          />
          <StatsCards
            title="אישרו היום"
            value={stats.confirmed}
            icon={CheckCircle}
            bgColor="bg-emerald-500"
            trend={`${stats.confirmationRate}% מסך החיילים`}
            onClick={() => handleCardClick('confirmed')}
          />
          <StatsCards
            title="ממתינים לאישור"
            value={stats.pending}
            icon={AlertCircle}
            bgColor="bg-orange-500"
            trend="חיילים שטרם אישרו"
            onClick={() => handleCardClick('pending')}
          />
          <StatsCards
            title="מכשירי צ' לא מאושרים"
            value={stats.unconfirmedSerial}
            icon={ShieldAlert}
            bgColor="bg-rose-500"
            trend="פריטים עם מספר סידורי"
            onClick={() => handleCardClick('unconfirmed_serial')}
          />
          {openReports.length > 0 && (
            <StatsCards
                title="פניות פתוחות"
                value={openReports.length}
                icon={FileWarning}
                bgColor="bg-amber-500"
                trend="דיווחים שממתינים לטיפול"
                onClick={() => handleCardClick('reports')}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConfirmationStatus 
            stats={stats}
            onSendReminders={() => setShowReminderDialog(true)}
            pendingCount={pendingNames.length}
            isSending={isSending}
          />
          <SoldiersList 
            confirmationData={confirmationData}
            loading={loading}
            onSoldierClick={handleSoldierClick}
          />
        </div>
        
        {openReports.length > 0 && (
            <div className="mt-6">
                <OpenReports 
                    reports={openReports}
                    onMarkAsHandled={handleMarkReportAsHandled}
                    isSending={isSending}
                />
            </div>
        )}

        <ManualConfirmationDialog
          open={showManualConfirmationDialog}
          onOpenChange={setShowManualConfirmationDialog}
          onConfirmationAdded={handleRefresh}
        />

        <ReminderConfirmationDialog
          open={showReminderDialog}
          onOpenChange={setShowReminderDialog}
          soldiers={confirmationData.filter(item => !item.confirmed)}
          onConfirm={handleSendReminders}
          isSending={isSending}
        />
        
        <DetailsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          dialogData={dialogData}
          dialogType={dialogType}
        />

        <PartialConfirmationDialog
          open={showPartialConfirmationDialog}
          onOpenChange={setShowPartialConfirmationDialog}
          soldierName={selectedPartialSoldier}
          onConfirmationUpdated={handlePartialConfirmationUpdated}
        />
      </div>
    </div>
  );
}