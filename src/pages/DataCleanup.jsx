import React, { useState } from "react";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { Soldier } from "@/entities/Soldier";
import { DailyConfirmation } from "@/entities/DailyConfirmation";
import { EquipmentSignature } from "@/entities/EquipmentSignature";
import { ReminderLog } from "@/entities/ReminderLog";
import { AppSettings } from "@/entities/AppSettings";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertTriangle, RefreshCw, Database } from "lucide-react";

export default function DataCleanup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await User.me();
        setUser(userData);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, message]);
  };

  const cleanupAllData = async () => {
    if (!window.confirm("⚠️ האם אתה בטוח שברצונך למחוק את כל הנתונים במערכת?\n\nפעולה זו בלתי הפיכה!")) {
      return;
    }

    if (!window.confirm("האם אתה באמת בטוח? זה יימחק הכל ולא ניתן לשחזר!")) {
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    const cleanupResults = {
      equipment: 0,
      equipmentTypes: 0,
      soldiers: 0,
      confirmations: 0,
      signatures: 0,
      reminderLogs: 0,
      appSettings: 0,
      errors: []
    };

    try {
      addLog("🔄 התחלת תהליך ניקוי נתונים...");

      // 1. מחיקת שיוכי ציוד
      addLog("📦 מוחק שיוכי ציוד...");
      try {
        const equipment = await Equipment.list();
        addLog(`נמצאו ${equipment?.length || 0} שיוכי ציוד`);
        
        if (equipment && equipment.length > 0) {
          for (const item of equipment) {
            try {
              await Equipment.delete(item.id);
              cleanupResults.equipment++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת שיוך ציוד ${item.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.equipment} שיוכי ציוד`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת שיוכי ציוד: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      // 2. מחיקת סוגי ציוד
      addLog("🔧 מוחק סוגי ציוד...");
      try {
        const equipmentTypes = await EquipmentType.list();
        addLog(`נמצאו ${equipmentTypes?.length || 0} סוגי ציוד`);
        
        if (equipmentTypes && equipmentTypes.length > 0) {
          for (const type of equipmentTypes) {
            try {
              await EquipmentType.delete(type.id);
              cleanupResults.equipmentTypes++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת סוג ציוד ${type.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.equipmentTypes} סוגי ציוד`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת סוגי ציוד: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      // 3. מחיקת אישורים יומיים
      addLog("📋 מוחק אישורים יומיים...");
      try {
        const confirmations = await DailyConfirmation.list();
        addLog(`נמצאו ${confirmations?.length || 0} אישורים יומיים`);
        
        if (confirmations && confirmations.length > 0) {
          for (const confirmation of confirmations) {
            try {
              await DailyConfirmation.delete(confirmation.id);
              cleanupResults.confirmations++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת אישור ${confirmation.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.confirmations} אישורים יומיים`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת אישורים: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      // 4. מחיקת חתימות דיגיטליות
      addLog("✍️ מוחק חתימות דיגיטליות...");
      try {
        const signatures = await EquipmentSignature.list();
        addLog(`נמצאו ${signatures?.length || 0} חתימות דיגיטליות`);
        
        if (signatures && signatures.length > 0) {
          for (const signature of signatures) {
            try {
              await EquipmentSignature.delete(signature.id);
              cleanupResults.signatures++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת חתימה ${signature.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.signatures} חתימות דיגיטליות`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת חתימות: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      // 5. מחיקת לוגי תזכורות
      addLog("🔔 מוחק לוגי תזכורות...");
      try {
        const reminderLogs = await ReminderLog.list();
        addLog(`נמצאו ${reminderLogs?.length || 0} לוגי תזכורות`);
        
        if (reminderLogs && reminderLogs.length > 0) {
          for (const log of reminderLogs) {
            try {
              await ReminderLog.delete(log.id);
              cleanupResults.reminderLogs++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת לוג תזכורת ${log.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.reminderLogs} לוגי תזכורות`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת לוגי תזכורות: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      // 6. מחיקת הגדרות מערכת
      addLog("⚙️ מוחק הגדרות מערכת...");
      try {
        const appSettings = await AppSettings.list();
        addLog(`נמצאו ${appSettings?.length || 0} הגדרות מערכת`);
        
        if (appSettings && appSettings.length > 0) {
          for (const setting of appSettings) {
            try {
              await AppSettings.delete(setting.id);
              cleanupResults.appSettings++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת הגדרה ${setting.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.appSettings} הגדרות מערכת`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת הגדרות: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      // 7. מחיקת חיילים (בסוף כדי לא לפגוע בשיוכים)
      addLog("👤 מוחק חיילים...");
      try {
        const soldiers = await Soldier.list();
        addLog(`נמצאו ${soldiers?.length || 0} חיילים`);
        
        if (soldiers && soldiers.length > 0) {
          for (const soldier of soldiers) {
            try {
              await Soldier.delete(soldier.id);
              cleanupResults.soldiers++;
            } catch (itemError) {
              addLog(`❌ שגיאה במחיקת חייל ${soldier.id}: ${itemError.message}`);
            }
          }
        }
        addLog(`✅ נמחקו ${cleanupResults.soldiers} חיילים`);
      } catch (error) {
        const errorMsg = `שגיאה במחיקת חיילים: ${error.message}`;
        cleanupResults.errors.push(errorMsg);
        addLog(`❌ ${errorMsg}`);
      }

      addLog("🎉 תהליך הניקוי הושלם!");
      setResults(cleanupResults);
      
      const totalDeleted = cleanupResults.equipment + cleanupResults.equipmentTypes + 
                          cleanupResults.soldiers + cleanupResults.confirmations + 
                          cleanupResults.signatures + cleanupResults.reminderLogs + 
                          cleanupResults.appSettings;
      
      alert(`ניקוי הנתונים הושלם!\nנמחקו בסך הכל: ${totalDeleted} רשומות\nהמערכת כעת נקייה ומוכנה לשימוש.`);

    } catch (error) {
      const errorMsg = `שגיאה כללית: ${error.message}`;
      cleanupResults.errors.push(errorMsg);
      addLog(`💥 ${errorMsg}`);
      setResults(cleanupResults);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            גישה אסורה. רק מנהלי מערכת יכולים לגשת לעמוד זה.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <Database className="w-8 h-8 text-red-600" />
          ניקוי נתוני מערכת
        </h1>
        <p className="text-slate-600">מחיקת כל הנתונים במערכת - שימוש בזהירות רבה!</p>
      </div>

      <Card className="border-2 border-red-200 bg-red-50/50 mb-6">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            אזהרה קריטית
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>פעולה בלתי הפיכה!</strong><br />
              הלחיצה על הכפתור למטה תמחק את כל הנתונים במערכת.
            </AlertDescription>
          </Alert>

          <div className="text-center pt-6 border-t border-red-200">
            <Button
              variant="destructive"
              size="lg"
              onClick={cleanupAllData}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  מוחק נתונים...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5 mr-2" />
                  מחק את כל הנתונים במערכת
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* לוגים בזמן אמת */}
      {logs.length > 0 && (
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-blue-800">התקדמות התהליך</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-60 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* תוצאות */}
      {results && (
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-green-800">תוצאות הניקוי</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{results.equipment}</div>
                <div className="text-sm text-blue-700">שיוכי ציוד</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{results.equipmentTypes}</div>
                <div className="text-sm text-blue-700">סוגי ציוד</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{results.soldiers}</div>
                <div className="text-sm text-blue-700">חיילים</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{results.confirmations}</div>
                <div className="text-sm text-blue-700">אישורים</div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {results.equipment + results.equipmentTypes + results.soldiers + 
                 results.confirmations + results.signatures + results.reminderLogs + 
                 results.appSettings}
              </div>
              <div className="text-lg text-green-700">סה"כ רשומות שנמחקו</div>
            </div>

            {results.errors.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>שגיאות שאירעו:</strong>
                  <ul className="mt-2 list-disc list-inside">
                    {results.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}