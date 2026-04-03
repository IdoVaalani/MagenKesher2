
import React, { useState, useEffect } from "react";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { DailyConfirmation as DailyConfirmationEntity } from "@/entities/DailyConfirmation";
import { SoldierToken } from "@/entities/SoldierToken";
import { User } from "@/entities/User";
// import { AppSettings } from "@/entities/AppSettings"; // No longer needed here
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle, RefreshCw, Package, Shield, MapPin, BadgeCheck } from "lucide-react";

export default function DailyConfirmation() {
  const [soldierData, setSoldierData] = useState(null);
  const [userEquipment, setUserEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [isTokenBased, setIsTokenBased] = useState(false);
  const [itemConfirmations, setItemConfirmations] = useState({});
  const [itemLocations, setItemLocations] = useState({});
  const [globalReportDetails, setGlobalReportDetails] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [allConfirmed, setAllConfirmed] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false); // מצב חדש לבדיקת אישור קיים

  // פונקציה להוספת הודעות דיבוג
  const addDebug = (message) => {
    console.log("DEBUG:", message);
    setDebugMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Function to re-load equipment data and reset confirmations/global report details
  const refreshPageData = async () => {
    if (soldierData?.email && soldierData?.full_name) {
      addDebug("🔄 מרענן נתוני ציוד לאחר אישור.");
      // loadEquipmentData will fetch new data and reset itemConfirmations/itemLocations based on *that new data*
      // It also ensures `userEquipment` is up-to-date.
      await loadEquipmentData(soldierData.email, soldierData.full_name);
      setGlobalReportDetails(""); // Clear the report text
      setAllConfirmed(false); // Uncheck select all
    } else {
      addDebug("⚠️ לא ניתן לרענן נתונים: חסרים פרטי חייל.");
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      setError(null);
      setDebugMessages([]);
      setAlreadyConfirmed(false);
      
      try {
        addDebug("🚀 מתחיל לטעון את הדף");
        
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        addDebug(`🔗 טוקן מה-URL: ${token ? 'קיים' : 'לא קיים'}`);
        
        let soldierName, soldierEmail;
        if (token) {
          addDebug("🎫 נמצא טוקן, מנסה לעבד אותו");
          setIsTokenBased(true);
          const tokenData = await handleTokenAccess(token);
          soldierName = tokenData.soldier_name;
          soldierEmail = tokenData.soldier_email;
          addDebug(`👤 חייל מהטוקן: ${soldierName}`);
        } else {
          addDebug("👤 לא נמצא טוקן, מנסה התחברות רגילה");
          setIsTokenBased(false);
          const currentUser = await User.me();
          soldierName = currentUser.full_name;
          soldierEmail = currentUser.email;
          addDebug(`👤 חייל מההתחברות: ${soldierName}`);
        }

        setSoldierData({ full_name: soldierName, email: soldierEmail });
        
        // **תיקון סופי: בדיקה פשוטה - רק אם אישור מלא**
        addDebug("🔎 בודק אישורים קודמים");
        
        const today = new Date().toISOString().split('T')[0];
        const existingConfirmations = await DailyConfirmationEntity.filter({
          soldier_name: soldierName,
          confirmation_date: today
        });
        
        addDebug(`📋 נמצאו ${existingConfirmations.length} אישורים קיימים להיום`);
        
        // רק אישור מלא חוסם כניסה חוזרת
        const hasCompleteConfirmation = existingConfirmations.some(conf => conf.is_complete_confirmation === true);
        const hasPartialConfirmation = existingConfirmations.some(conf => conf.is_complete_confirmation === false);
        
        addDebug(`✅ אישור מלא: ${hasCompleteConfirmation}, אישור חלקי: ${hasPartialConfirmation}`);
        
        if (hasCompleteConfirmation) {
          addDebug("✅ נמצא אישור מלא קיים להיום - חוסם כניסה.");
          setAlreadyConfirmed(true);
          setLoading(false);
          return;
        }
        
        // אם אין אישור מלא - תמיד נכנסים לטעינת הציוד
        addDebug("⚡ מאפשר כניסה לאישור (אין אישור מלא או יש אישור חלקי)");
        await loadEquipmentData(soldierEmail, soldierName);

      } catch (error) {
        addDebug(`❌ שגיאה: ${error.message}`);
        setError(`שגיאה בטעינת הדף: ${error.message}`);
      } finally {
        addDebug("✅ סיום טעינה");
        setLoading(false);
      }
    };
    
    initializePage();
  }, []);

  // סנכרון תיבת "בחר הכל" עם התיבות הבודדות
  useEffect(() => {
    if (userEquipment.length > 0) {
      const allAreChecked = userEquipment.every(item => itemConfirmations[item.key]);
      setAllConfirmed(allAreChecked);
    } else {
      setAllConfirmed(false);
    }
  }, [itemConfirmations, userEquipment]);

  const handleTokenAccess = async (token) => {
    try {
      addDebug("🔍 בודק תקינות הטוקן");
      
      const tokenData = await SoldierToken.filter({ 
        token: token, 
        token_type: "daily_confirmation", 
        used: false 
      });
      
      addDebug(`🔍 נמצאו ${tokenData.length} טוקנים תואמים`);
      
      if (!tokenData || tokenData.length === 0) {
        addDebug("❌ טוקן לא נמצא או כבר נוצל");
        throw new Error("קישור לא תקין או שפג תוקפו");
      }
      
      const validToken = tokenData[0];
      addDebug(`✅ טוקן נמצא עבור ${validToken.soldier_name}`);
      
      const now = new Date();
      const expiresAt = new Date(validToken.expires_at);
      addDebug(`⏰ זמן נוכחי: ${now.toISOString()}, תפוגה: ${expiresAt.toISOString()}`);
      
      if (now > expiresAt) {
        addDebug("❌ טוקן פג תוקף");
        throw new Error("קישור פג תוקף");
      }
      
      addDebug(`✅ טוקן תקין עבור ${validToken.soldier_name}`);
      return validToken;
      
    } catch (error) {
      addDebug(`❌ שגיאה בטוקן: ${error.message}`);
      throw error;
    }
  };

  const loadEquipmentData = async (email, soldierName) => {
    try {
      addDebug(`📦 מחפש ציוד עבור ${soldierName}`);
      
      const assignments = await Equipment.filter({
        soldier_name: soldierName,
        requires_soldier_confirmation: true,
        status: "active"
      });
      
      addDebug(`📋 נמצאו ${assignments.length} פריטי ציוד`);
      
      if (assignments.length > 0) {
        const equipmentTypes = await EquipmentType.list();
        const typesMap = new Map(equipmentTypes.map(t => [t.id, t]));
        
        const enrichedAssignments = assignments.map(a => ({
          ...a,
          itemDetails: typesMap.get(a.equipment_type_id) || { name: 'לא ידוע' }
        }));

        // לוגיקת קיבוץ פריטים
        const ancillaryItemsMap = new Map();
        const finalEquipmentList = [];

        for (const assignment of enrichedAssignments) {
            const type = assignment.itemDetails;
            if (type && type.serial_number) {
                // פריט ייחודי עם מספר צ'
                finalEquipmentList.push({
                    ...assignment,
                    isGrouped: false,
                    key: `unique-${assignment.id}`
                });
            } else {
                // פריט נלווה ללא מספר צ' - יש לקבץ
                const typeId = assignment.equipment_type_id;
                if (!ancillaryItemsMap.has(typeId)) {
                    ancillaryItemsMap.set(typeId, {
                        isGrouped: true,
                        key: `grouped-${typeId}`,
                        itemDetails: type,
                        equipment_type_id: typeId,
                        quantity: 0,
                        assignment_ids: [],
                    });
                }
                const group = ancillaryItemsMap.get(typeId);
                group.quantity += 1;
                group.assignment_ids.push(assignment.id);
            }
        }
        
        // Add grouped items to the final list
        ancillaryItemsMap.forEach(group => finalEquipmentList.push(group));

        setUserEquipment(finalEquipmentList);
        
        // אתחול מצב אישורים ומקומות
        const initialConfirmations = {};
        const initialLocations = {};
        finalEquipmentList.forEach(item => {
          initialConfirmations[item.key] = false; // Always start unchecked
          if (!item.isGrouped) { // רק לפריטים בודדים
            initialLocations[item.id] = item.location || "";
          }
        });
        setItemConfirmations(initialConfirmations);
        setItemLocations(initialLocations);
        
        addDebug("✅ ציוד קובץ ומוכן לתצוגה");
      } else {
        addDebug("📭 לא נמצא ציוד");
        setUserEquipment([]);
      }
      
    } catch (error) {
      addDebug(`❌ שגיאה בטעינת ציוד: ${error.message}`);
      throw error;
    }
  };

  const handleSelectAll = (isChecked) => {
    setAllConfirmed(isChecked);
    const newConfirmations = {};
    for (const item of userEquipment) {
        newConfirmations[item.key] = isChecked;
    }
    setItemConfirmations(newConfirmations);
  };

  const handleFinalConfirmation = async () => {
    const confirmedKeys = Object.keys(itemConfirmations).filter(key => itemConfirmations[key]);
    if (userEquipment.length > 0 && confirmedKeys.length === 0 && globalReportDetails.trim() === "") {
      alert("יש לאשר לפחות פריט ציוד אחד או למלא דיווח על בעיות.");
      return;
    }

    setConfirming(true);
    try {
      addDebug("💾 שומר אישור ועדכונים");
      
      const todayISO = new Date().toISOString().split('T')[0];
      const now = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

      // איסוף כל מזהי השיוך המקוריים של הפריטים שאושרו
      const confirmedItems = userEquipment.filter(item => itemConfirmations[item.key]);
      const confirmedAssignmentIds = confirmedItems.flatMap(item => item.isGrouped ? item.assignment_ids : [item.id]);

      // **שינוי קריטי: בדיקה האם אושר הכל**
      const totalItems = userEquipment.length;
      const confirmedItemsCount = confirmedItems.length;
      // A confirmation is complete if all items that require confirmation are confirmed,
      // OR if there are no items to confirm and a report is made.
      const isCompleteConfirmation = (confirmedItemsCount === totalItems && totalItems > 0) || (totalItems === 0 && globalReportDetails.trim() !== "");

      // מחיקת אישורים קודמים (חלקיים או מלאים) של אותו חייל מאותו יום
      const existingConfirmationsForToday = await DailyConfirmationEntity.filter({
        soldier_name: soldierData.full_name,
        confirmation_date: todayISO
      });
      
      for (const oldConfirmation of existingConfirmationsForToday) {
        await DailyConfirmationEntity.delete(oldConfirmation.id);
        addDebug(`🗑️ נמחק אישור קודם ${oldConfirmation.id} מיום ${todayISO}`);
      }

      // 1. יצירת רשומת אישור חדשה
      await DailyConfirmationEntity.create({
        soldier_name: soldierData.full_name,
        soldier_id: "", // ניתן להוסיף אם זמין
        confirmation_date: todayISO,
        equipment_ids: confirmedAssignmentIds,
        total_equipment_count: totalItems, // New field
        is_complete_confirmation: isCompleteConfirmation, // New field
        confirmation_time: now,
        device_info: navigator.userAgent,
        report_details: globalReportDetails.trim(),
        report_handled: !globalReportDetails.trim() // If there's a report, it's not yet handled.
      });
      addDebug("✅ רשומת אישור נשמרה");

      // 2. עדכון מיקומים ותאריכי אישור אחרון בפריטי הציוד
      const updatePromises = [];
      const updatedItems = new Set(); // למנוע עדכון כפול

      confirmedItems.forEach(item => {
        const originalAssignmentIds = item.isGrouped ? item.assignment_ids : [item.id];
        originalAssignmentIds.forEach(id => {
          if (!updatedItems.has(id)) {
              const payload = { last_confirmation_date: todayISO };
              
              // הוספת מיקום רק לפריטים בודדים, אם השתנה
              if (!item.isGrouped && itemLocations[id] !== undefined && itemLocations[id] !== item.location) {
                  payload.location = itemLocations[id];
              }

              updatePromises.push(Equipment.update(id, payload));
              updatedItems.add(id);
          }
        });
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        addDebug(`✅ עודכנו ${updatePromises.length} פריטי ציוד עם תאריך ומיקום.`);
      }

      // **הודעות מותאמות לפי סוג האישור**
      if (isCompleteConfirmation) {
        alert("האישור המלא נשלח בהצלחה! תודה על האישור.");
        setAlreadyConfirmed(true); // Full confirmation, so set as already confirmed for the day
      } else {
        alert(`אושרו ${confirmedItemsCount} מתוך ${totalItems} פריטים.\n\nתוכל לחזור לקישור זה מאוחר יותר כדי להשלים את האישור על הפריטים שלא אושרו עדיין.`);
        // Do NOT setAlreadyConfirmed(true) here, as it's a partial confirmation
        await refreshPageData(); // Refresh the equipment list to show unconfirmed items
      }
      
    } catch (error) {
      addDebug(`❌ שגיאה בשמירה: ${error.message}`);
      setError(`שגיאה בשמירת האישור: ${error.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const renderContent = () => {
      if (loading) {
        return (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-2">טוען נתונים...</h1>
            <p className="text-gray-600">אנא המתן...</p>
          </div>
        );
      }
      
      if (error) {
        return (
          <div className="text-center py-8">
            <div className="text-red-600 mb-4 text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold mb-4 text-red-800">שגיאה</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>רענן דף</Button>
          </div>
        );
      }

      if (alreadyConfirmed) {
        return (
          <div className="text-center py-8 max-w-lg mx-auto">
            <BadgeCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-slate-800">הציוד כבר אושר להיום</h1>
            <p className="text-slate-600">תודה {soldierData?.full_name}, האישור שלך התקבל בהצלחה. אין צורך בפעולה נוספת.</p>
          </div>
        )
      }

      return (
          <div className="max-w-2xl mx-auto">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  אישור ציוד יומי - {soldierData?.full_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-green-600 mb-4">✅ גישה בטוחה ללא צורך בהתחברות</p>
                
                {userEquipment.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="mb-4">לא נמצא ציוד הדורש אישור</p>
                    <Textarea
                      value={globalReportDetails}
                      onChange={(e) => setGlobalReportDetails(e.target.value)}
                      placeholder="דווח על ציוד חסר או בעיות..."
                      className="mb-4"
                    />
                    <Button onClick={handleFinalConfirmation} disabled={confirming}>
                      {confirming ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                      שלח דיווח
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-lg">
                      <Checkbox
                          id="select-all"
                          checked={allConfirmed}
                          onCheckedChange={handleSelectAll}
                      />
                      <label htmlFor="select-all" className="font-semibold text-base cursor-pointer">
                          אישור כללי
                      </label>
                    </div>

                    <h3 className="font-semibold">ציוד לאישור ({userEquipment.length} שורות):</h3>
                    
                    {userEquipment.map((item) => (
                      <div key={item.key} className="border rounded p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={itemConfirmations[item.key] || false}
                            onCheckedChange={(checked) => 
                              setItemConfirmations(prev => ({ ...prev, [item.key]: checked }))
                            }
                          />
                          <div>
                            <h4 className="font-semibold">{item.itemDetails.name}</h4>
                            <p className="text-sm text-gray-600">
                                {item.isGrouped 
                                    ? `כמות: ${item.quantity}` 
                                    : `מספר צ': ${item.itemDetails.serial_number || 'אין'}`}
                            </p>
                          </div>
                        </div>
                        
                        {!item.isGrouped && item.itemDetails.serial_number && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <Input
                              value={itemLocations[item.id] || ""}
                              onChange={(e) => 
                                setItemLocations(prev => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="מקום הציוד..."
                              className="flex-1"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <Textarea
                      value={globalReportDetails}
                      onChange={(e) => setGlobalReportDetails(e.target.value)}
                      placeholder="הערות נוספות או דיווח על בעיות..."
                    />
                    
                    <Button 
                      onClick={handleFinalConfirmation} 
                      disabled={confirming}
                      className="w-full"
                    >
                      {confirming ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      {confirming ? "מאשר..." : "אשר סופית"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">יומן טעינה (לבדיקה)</CardTitle>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="show-debug"
                            checked={showDebugLog}
                            onCheckedChange={setShowDebugLog}
                        />
                        <label htmlFor="show-debug" className="text-sm font-medium text-slate-600 cursor-pointer">
                            הצג יומן
                        </label>
                    </div>
                </div>
              </CardHeader>
              {showDebugLog && (
                <CardContent>
                    <div className="text-xs space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                    {debugMessages.map((msg, index) => (
                        <div key={index} className="font-mono">{msg}</div>
                    ))}
                    </div>
                </CardContent>
              )}
            </Card>
          </div>
      );
  };

  if (isTokenBased) {
    return (
      <div style={{ direction: 'rtl' }} className="p-4 bg-gray-50 min-h-screen">
        <style>{`* { direction: rtl; }`}</style>
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">אישור ציוד יומי</h1>
      {renderContent()}
    </div>
  );
}
