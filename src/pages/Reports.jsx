
import React, { useState, useEffect, useMemo } from "react";
import { DailyConfirmation } from "@/entities/DailyConfirmation";
import { EquipmentSignature } from "@/entities/EquipmentSignature";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType"; // New import for EquipmentType
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Calendar, BarChart3, CheckCircle, XCircle, CalendarRange, Search, PenTool, User, Eye, Trash2, CalendarDays, History, RefreshCw, Package, Users, Award } from "lucide-react"; // Replaced Timeline with History, added RefreshCw, added Package, added Users, added Award
import { differenceInDays } from "date-fns";
import EquipmentTrackingReport from "@/components/reports/EquipmentTrackingReport"; // New import for the moved component
import EquipmentInventoryReport from "@/components/reports/EquipmentInventoryReport"; // New import for EquipmentInventoryReport
import SoldierEquipmentSummary from "@/components/reports/SoldierEquipmentSummary"; // New import for SoldierEquipmentSummary
import SignedEquipmentSummary from "@/components/reports/SignedEquipmentSummary"; // New import for SignedEquipmentSummary

// Helper function to get current date in YYYY-MM-DD format for Israel time
function getIsraelDateString() {
  const today = new Date();
  // Adjust for Israel Time Zone (UTC+2/3). Assuming UTC+3 for safety to ensure YYYY-MM-DD format.
  const offset = today.getTimezoneOffset() * 60 * 1000;
  const israelTime = new Date(today.getTime() + offset + (3 * 60 * 60 * 1000));
  return israelTime.toISOString().split('T')[0];
}

export default function Reports() {
  // States for confirmations report
  const [startDate, setStartDate] = useState(getIsraelDateString());
  const [endDate, setEndDate] = useState(getIsraelDateString());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  // States for signatures report
  const [signatures, setSignatures] = useState([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSignature, setSelectedSignature] = useState(null); // Changed to null for initial state

  // States for equipment report
  const [equipmentStartDate, setEquipmentStartDate] = useState(getIsraelDateString());
  const [equipmentEndDate, setEquipmentEndDate] = useState(getIsraelDateString());
  const [equipmentData, setEquipmentData] = useState([]);
  const [equipmentLoading, setLoadingEquipment] = useState(false);

  useEffect(() => {
    // Load confirmations report data on initial mount
    // It's better to load default data, or prompt user to click "הפק דוח"
    // For now, keep as is, will be triggered by button click
  }, []);

  // New useEffect for signatures, loads them on component mount (or when tab is active)
  useEffect(() => {
    loadSignatures();
  }, []);

  // Updated function to load digital signatures with better error handling
  const loadSignatures = async () => {
    setSignaturesLoading(true);
    try {
      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const data = await Promise.race([
        EquipmentSignature.list("-created_date"),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 25000)
        )
      ]);

      clearTimeout(timeoutId);
      setSignatures(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading signatures:", error);
      
      // Try again with a simpler approach
      try {
        console.log("Retrying signatures load with basic filter...");
        // Assuming EquipmentSignature.filter can take an empty object to get all
        const fallbackData = await EquipmentSignature.list(); 
        setSignatures(Array.isArray(fallbackData) ? fallbackData : []);
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        setSignatures([]);
        
        // Don't show alert for aborted requests, just log
        if (!error.message?.includes('aborted') && !error.message?.includes('timeout')) {
          alert("שגיאה בטעינת חתימות דיגיטליות");
        }
      }
    }
    setSignaturesLoading(false);
  };

  const flattenedSignatures = useMemo(() => {
    if (!Array.isArray(signatures) || signatures.length === 0) return [];
    
    try {
      const flatList = signatures
        // Removed the filter by status here to include all signatures for historical view
        .flatMap(signature => {
          if (!signature.equipment_items || !Array.isArray(signature.equipment_items)) {
            return [];
          }
          
          return signature.equipment_items.map(item => ({
            ...item,
            signatureId: signature.id,
            soldier_name: signature.soldier_name,
            soldier_id: signature.soldier_id,
            signature_date: signature.signature_date,
            signature_time: signature.signature_time,
            signature_data: signature.signature_data,
            status: signature.status, // Keep status for display
          }));
        });
      
      if (!searchTerm.trim()) return flatList;
      
      const searchLower = searchTerm.toLowerCase();
      return flatList.filter(item => 
        item.soldier_name?.toLowerCase().includes(searchLower) ||
        item.soldier_id?.toLowerCase().includes(searchLower) ||
        item.equipment_name?.toLowerCase().includes(searchLower) ||
        item.serial_number?.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error("Error processing signatures:", error);
      return [];
    }
  }, [signatures, searchTerm]);

  // Updated handleRevokeSignature with better error handling
  const handleRevokeSignature = async (signatureId) => {
    if (!signatureId) {
      alert("שגיאה: מזהה חתימה לא תקין");
      return;
    }

    if (window.confirm("האם אתה בטוח שברצונך לבטל את תוקף החתימה? פעולה זו אינה הפיכה ותשנה את הסטטוס של כל הציוד בחתימה זו ל'בוטל'.")) {
      try {
        await EquipmentSignature.update(signatureId, { status: 'revoked' });
        
        // Update local state immediately for better UX
        setSignatures(prev => 
          prev.map(sig => 
            sig.id === signatureId ? { ...sig, status: 'revoked' } : sig
          )
        );
        
        alert("החתימה בוטלה בהצלחה.");
      } catch (error) {
        console.error("Error revoking signature:", error);
        alert("שגיאה בביטול החתימה. נסה שוב מאוחר יותר.");
      }
    }
  };

  const loadReportData = async () => {
    if (!startDate || !endDate) {
      alert("יש לבחור תאריכים תקינים");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert("תאריך התחלה חייב להיות לפני תאריך הסיום");
      return;
    }

    const daysDiff = differenceInDays(new Date(endDate), new Date(startDate));
    if (daysDiff > 31) {
      alert("ניתן לבחור טווח של עד 31 ימים בלבד");
      return;
    }

    setLoading(true);
    try {
      // Get all confirmations in the date range
      const allConfirmations = await DailyConfirmation.list("-confirmation_date", 1000);
      const confirmationsInRange = allConfirmations.filter(c => 
        c.confirmation_date >= startDate && c.confirmation_date <= endDate
      );

      // Get all soldiers who have equipment requiring confirmation
      const allEquipment = await Equipment.filter({ requires_soldier_confirmation: true, status: 'active' });
      const allSoldiersWithEquipment = [...new Set(allEquipment.map(eq => eq.soldier_name).filter(Boolean))];
      
      // Get equipment types for mapping
      const allEquipmentTypes = await EquipmentType.list();
      const equipmentTypesMap = new Map(allEquipmentTypes.map(type => [type.id, type]));

      // Build report data by date
      const reportByDate = {};
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayConfirmations = confirmationsInRange.filter(c => c.confirmation_date === dateStr);
        
        // Only include soldiers if there were ANY confirmations on this day
        const confirmedSoldiers = dayConfirmations.map(c => c.soldier_name);
        const hasConfirmations = dayConfirmations.length > 0;
        
        const confirmationsWithEquipment = dayConfirmations.map(confirmation => {
          const soldierEquipment = allEquipment.filter(eq => 
            confirmation.equipment_ids?.includes(eq.id) && eq.soldier_name === confirmation.soldier_name
          );
          
          const equipmentDetails = soldierEquipment.map(eq => {
            const type = equipmentTypesMap.get(eq.equipment_type_id);
            return type ? {
              name: type.name,
              serial_number: eq.serial_number || null // Use equipment's specific serial number if available
            } : null;
          }).filter(Boolean);

          return {
            ...confirmation,
            equipmentDetails
          };
        });
        
        reportByDate[dateStr] = {
          date: dateStr,
          confirmations: confirmationsWithEquipment, // Using enriched data
          confirmedSoldiers,
          // Only calculate pending soldiers if there were confirmations on this day
          pendingSoldiers: hasConfirmations ? 
            allSoldiersWithEquipment.filter(name => !confirmedSoldiers.includes(name)) : [],
          totalSoldiers: hasConfirmations ? allSoldiersWithEquipment.length : 0,
          confirmedCount: confirmedSoldiers.length,
          pendingCount: hasConfirmations ? 
            allSoldiersWithEquipment.length - confirmedSoldiers.length : 0,
          hasActivity: hasConfirmations
        };

        currentDate.setDate(currentDate.getDate() + 1);
      }

      setReportData(reportByDate);

    } catch (error) {
      console.error("Error loading report data:", error);
      alert("שגיאה בטעינת נתוני הדוח");
      setReportData(null);
    }
    setLoading(false);
  };

  const exportReport = () => {
    if (!reportData) return;

    const reportDates = Object.keys(reportData).sort().filter(date => reportData[date].hasActivity);
    
    if (reportDates.length === 0) {
      alert("אין נתונים לייצוא - לא היו אישורים בטווח התאריכים שנבחר");
      return;
    }

    let csvContent = '';
    
    reportDates.forEach((dateStr, index) => {
      const dayData = reportData[dateStr];
      const formattedDate = new Date(dateStr).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
      
      if (index > 0) csvContent += '\n\n';
      csvContent += `,,,"דוח יום ${formattedDate}"\n`;
      csvContent += 'שם החייל,סטטוס אישור,שעת אישור,ציוד שאושר,דיווח\n';
      
      const allSoldiersInDay = [...new Set([
        ...dayData.confirmedSoldiers,
        ...dayData.pendingSoldiers
      ])];
      
      allSoldiersInDay.forEach(soldierName => {
        const confirmation = dayData.confirmations.find(c => c.soldier_name === soldierName);
        
        let status, time, report, equipmentText;
        
        if (confirmation) {
          status = 'אושר';
          time = confirmation.confirmation_time || '';
          report = confirmation.report_details || '';
          
          if (confirmation.equipmentDetails && confirmation.equipmentDetails.length > 0) {
            equipmentText = confirmation.equipmentDetails.map(eq => {
              const serialPart = eq.serial_number ? ` (צ': '${eq.serial_number})` : ''; // *** תיקון גם כאן ***
              return `${eq.name}${serialPart}`;
            }).join('; ');
          } else {
            equipmentText = 'לא זמין';
          }
            
        } else {
          status = 'לא אושר';
          time = '';
          report = '';
          equipmentText = '';
        }
        
        const escapeCSV = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        
        const row = [
          escapeCSV(soldierName),
          escapeCSV(status),
          escapeCSV(time),
          escapeCSV(equipmentText),
          escapeCSV(report)
        ].join(',');
        
        csvContent += row + '\n';
      });
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob); // Define 'url' here
    link.href = url; // Use the defined 'url'
    link.download = `confirmation_report_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Now 'url' is defined
  };

  const exportSignatures = () => {
    if (flattenedSignatures.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        // Add a check for valid date
        if (isNaN(date.getTime())) return dateStr;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      } catch(e) {
        return dateStr;
      }
    };

    const exportData = flattenedSignatures.map(item => ({
      'שם החייל': item.soldier_name || '',
      'מספר אישי': item.soldier_id || '',
      'שם ציוד': item.equipment_name || '',
      'מספר צ\'': item.serial_number ? `'${item.serial_number}` : 'N/A',
      'תאריך חתימה': formatDate(item.signature_date),
      'שעת חתימה': item.signature_time || '',
      'סטטוס': item.status === 'active' ? 'פעיל' : 'בוטל'
    }));

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => {
        let value = row[header] || '';
        // Escape double quotes within the value and then wrap the whole value in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `חתימות_ציוד_מפורט_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadEquipmentReport = async () => {
    if (!equipmentStartDate || !equipmentEndDate) {
      alert("יש לבחור תאריכים תקינים");
      return;
    }

    if (new Date(equipmentStartDate) > new Date(equipmentEndDate)) {
      alert("תאריך התחלה חייב להיות לפני תאריך הסיום");
      return;
    }

    setLoadingEquipment(true);
    try {
      const [allEquipment, allTypes] = await Promise.all([
        Equipment.list("-created_date"),
        EquipmentType.list()
      ]);

      const typesMap = new Map(allTypes.map(type => [type.id, type]));
      
      // Filter for equipment associated with a type that has a 'serial_number' property
      // Note: This assumes EquipmentType has a 'serial_number' property,
      // which might typically be 'requires_serial_number' (boolean) or another field.
      const equipmentWithSerialNumber = allEquipment.filter(eq => {
        const type = typesMap.get(eq.equipment_type_id);
        // Assuming `type.serial_number` being truthy means it requires one, or is the serial itself.
        // A more robust check might be `type && type.requires_serial_number` if such a field exists.
        return type && type.serial_number; 
      });

      // Filter equipment by date range
      const filteredEquipment = equipmentWithSerialNumber.filter(eq => {
        const lastConfDate = eq.last_confirmation_date; // Assuming YYYY-MM-DD
        const createdDate = eq.created_date ? eq.created_date.split('T')[0] : null; // Extract YYYY-MM-DD

        // Check if either date falls within the range
        const withinLastConf = lastConfDate && lastConfDate >= equipmentStartDate && lastConfDate <= equipmentEndDate;
        const withinCreated = createdDate && createdDate >= equipmentStartDate && createdDate <= equipmentEndDate;

        return withinLastConf || withinCreated;
      });

      // Create report data
      const reportEquipment = filteredEquipment.map(eq => {
        const type = typesMap.get(eq.equipment_type_id);
        return {
          equipment_name: type?.name || 'לא ידוע', // Prefer equipment type's name as per outline
          serial_number: type?.serial_number || '', // Use equipment type's serial_number as per outline
          soldier_name: eq.soldier_name || '',
          location: eq.location || '',
          last_confirmation: eq.last_confirmation_date || '',
          status: eq.status || 'active'
        };
      });

      setEquipmentData(reportEquipment);
    } catch (error) {
      console.error("Error loading equipment report:", error);
      alert("שגיאה בטעינת דוח הציוד");
      setEquipmentData([]);
    }
    setLoadingEquipment(false);
  };

  const exportEquipmentReport = () => {
    if (equipmentData.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const exportData = equipmentData.map(item => ({
      'שם ציוד': item.equipment_name,
      'מספר צ\'': item.serial_number ? `'${item.serial_number}` : '', // *** תיקון: הוספת ' בתחילה ***
      'שם חייל': item.soldier_name,
      'מקום': item.location || '',
      'אישור אחרון': item.last_confirmation ? 
        new Date(item.last_confirmation).toLocaleDateString('he-IL') : 'לא אושר' // Formatted date
    }));

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => {
        let value = row[header] || '';
        // Escape double quotes within the value and then wrap the whole value in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `דוח_ציוד_עם_צ_${equipmentStartDate}_עד_${equipmentEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTotalStats = () => {
    if (!reportData) return { totalDays: 0, totalConfirmations: 0, activeDays: 0 };
    
    const dates = Object.keys(reportData);
    const activeDays = dates.filter(date => reportData[date].hasActivity).length;
    const totalConfirmations = dates.reduce((sum, date) => 
      sum + reportData[date].confirmedCount, 0
    );
    
    return {
      totalDays: dates.length,
      activeDays,
      totalConfirmations
    };
  };

  const stats = getTotalStats();

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">דוחות מערכת</h1>
            <p className="text-slate-600">דוחות אישורים, חתימות דיגיטליות וציוד</p>
          </div>
        </div>

        <Tabs defaultValue="confirmations" className="w-full">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="confirmations" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              דוחות אישורים
            </TabsTrigger>
            <TabsTrigger value="signatures" className="flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              חתימות דיגיטליות
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              דוח ציוד
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              דוח ציודים
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              מעקב מכשירים
            </TabsTrigger>
            <TabsTrigger value="soldier-summary" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              סיכום לפי חייל
            </TabsTrigger>
            <TabsTrigger value="signed-summary" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              ציוד חתום
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmations" className="space-y-6">
            <div className="flex justify-end mb-6">
              <Button 
                onClick={exportReport}
                disabled={!reportData || loading || stats.activeDays === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                יצוא דוח אישורים ({stats.activeDays} גליונות)
              </Button>
            </div>

            {/* Date Range Selector */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-blue-600" />
                  בחירת טווח תאריכים לדוח
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="start-date">מתאריך:</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="end-date">עד תאריך:</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Button onClick={loadReportData} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? "טוען..." : "הפק דוח"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  ניתן לבחור טווח של עד 31 ימים. הדוח יציג רק ימים שבהם היו אישורים.
                </p>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            {reportData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-blue-600">ימים בטווח</p>
                        <p className="text-2xl font-bold text-blue-800">{stats.totalDays}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">ימים עם פעילות</p>
                        <p className="text-2xl font-bold text-green-800">{stats.activeDays}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-8 h-8 text-purple-600" />
                      <div>
                        <p className="text-sm text-purple-600">סה"כ אישורים</p>
                        <p className="text-2xl font-bold text-purple-800">{stats.totalConfirmations}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Daily Reports */}
            {loading ? (
              <Card>
                <CardContent className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p>טוען נתוני דוח...</p>
                </CardContent>
              </Card>
            ) : !reportData ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-slate-500">בחר טווח תאריכים כדי להציג דוח</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.keys(reportData).sort((a, b) => new Date(b) - new Date(a)).map(dateStr => { // Sort descending
                  const dayData = reportData[dateStr];
                  
                  // Skip days with no activity
                  if (!dayData.hasActivity) return null;
                  
                  return (
                    <Card key={dateStr} className="border-l-4 border-l-blue-500">
                      <CardHeader className="bg-slate-50">
                        <CardTitle className="flex items-center justify-between">
                          <span>
                            {new Date(dateStr).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })} - {" "}
                            {new Date(dateStr).toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' })}
                          </span>
                          <div className="flex gap-2">
                            <Badge className="bg-green-100 text-green-800">
                              {dayData.confirmedCount} אישרו
                            </Badge>
                            {dayData.pendingCount > 0 && (
                              <Badge className="bg-red-100 text-red-800">
                                {dayData.pendingCount} לא אישרו
                              </Badge>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Confirmed Soldiers */}
                          {dayData.confirmedSoldiers.map(soldierName => {
                            const confirmation = dayData.confirmations.find(c => c.soldier_name === soldierName);
                            return (
                              <div key={`${dateStr}-${soldierName}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-3">
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                  <div>
                                    <p className="font-semibold text-green-800">{soldierName}</p>
                                    <p className="text-sm text-green-600">
                                      אושר בשעה: {confirmation?.confirmation_time || 'לא זמין'}
                                    </p>
                                    {confirmation?.equipmentDetails && confirmation.equipmentDetails.length > 0 && (
                                      <p className="text-xs text-gray-500 mt-1">
                                         ציוד: {confirmation.equipmentDetails
                                          .filter(eq => eq.serial_number)
                                          .map(eq => `${eq.name} (צ': ${eq.serial_number})`)
                                          .join(', ') || 'אין פירוט ציוד'
                                        }
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-green-100 text-green-800">אושר</Badge>
                                  {confirmation?.report_details && (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                      יש דיווח
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Pending Soldiers */}
                          {dayData.pendingSoldiers.map(soldierName => (
                            <div key={`${dateStr}-pending-${soldierName}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                              <div className="flex items-center gap-3">
                                <XCircle className="w-5 h-5 text-red-600" />
                                <div>
                                  <p className="font-semibold text-red-800">{soldierName}</p>
                                  <p className="text-sm text-red-600">לא אישר</p>
                                </div>
                              </div>
                              <Badge className="bg-red-100 text-red-800">לא אושר</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {stats.activeDays === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">אין פעילות בטווח שנבחר</h3>
                      <p className="text-slate-500">לא היו אישורי ציוד בתאריכים שנבחרו</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="signatures" className="space-y-6">
            <div className="flex justify-end mb-6">
              <Button onClick={exportSignatures} disabled={flattenedSignatures.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                יצוא דוח חתימות ({flattenedSignatures.length})
              </Button>
            </div>

            {/* Search */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="חפש לפי שם חייל, מספר אישי, שם ציוד או מספר צ'..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <PenTool className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-blue-600">חתימות פעילות</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {Array.isArray(signatures) ? signatures.filter(s => s && s.status === 'active').length : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <User className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">חיילים שחתמו</p>
                      <p className="text-2xl font-bold text-green-800">
                        {Array.isArray(signatures) ? 
                          new Set(signatures.filter(s => s && s.status === 'active').map(s => s.soldier_name)).size : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-red-50 border-red-200"> {/* Changed styling for revoked signatures */}
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-red-600" /> {/* Changed icon to XCircle */}
                    <div>
                      <p className="text-sm text-red-600">חתימות מבוטלות</p> {/* Changed text */}
                      <p className="text-2xl font-bold text-red-800">
                        {Array.isArray(signatures) ? signatures.filter(s => s && s.status === 'revoked').length : 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Signatures List */}
            <Card>
              <CardHeader>
                <CardTitle>פירוט חתימות ({flattenedSignatures.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {signaturesLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>טוען חתימות...</p>
                  </div>
                ) : flattenedSignatures.length === 0 ? (
                  <div className="text-center py-8">
                    <PenTool className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">
                      {signatures.length === 0 ? "אין חתימות במערכת" : "אין חתימות התואמות לחיפוש"}
                    </h3>
                    <p className="text-slate-500">
                      {signatures.length === 0 
                        ? "לא נמצאו חתימות דיגיטליות במערכת." 
                        : "לא נמצאו חתימות דיגיטליות התואמות את מונחי החיפוש."}
                    </p>
                    {signatures.length === 0 && (
                      <Button 
                        onClick={loadSignatures} 
                        variant="outline" 
                        className="mt-4"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        נסה לטעון שוב
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שם החייל</TableHead>
                          <TableHead>מספר אישי</TableHead>
                          <TableHead>שם ציוד</TableHead>
                          <TableHead>מספר צ'</TableHead>
                          <TableHead>תאריך ושעה</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flattenedSignatures.map((item, index) => (
                          <TableRow 
                            key={`${item.signatureId}-${item.equipment_type_id || item.equipment_name}-${index}`} 
                            className={item.status === 'revoked' ? 'bg-red-50/50 hover:bg-red-100/50' : 'hover:bg-slate-50'} // Added class for revoked signatures
                          >
                            <TableCell>{item.soldier_name || '-'}</TableCell>
                            <TableCell>{item.soldier_id || '-'}</TableCell>
                            <TableCell>{item.equipment_name || '-'}</TableCell>
                            <TableCell>{item.serial_number || '-'}</TableCell>
                            <TableCell>
                              {item.signature_date && item.signature_time 
                                ? `${item.signature_date} ${item.signature_time}` 
                                : item.signature_date || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {item.status === 'active' ? 'פעיל' : 'בוטל'}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedSignature(item)}
                                title="הצג חתימה"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                              </Button>
                              {item.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRevokeSignature(item.signatureId)}
                                  title="בטל חתימה"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Modal */}
            {selectedSignature && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
                onClick={() => setSelectedSignature(null)}
              >
                <div 
                  className="bg-white rounded-lg p-6 max-w-md w-full mx-auto max-h-[90vh] overflow-y-auto" 
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-xl font-bold mb-4">חתימה של {selectedSignature.soldier_name}</h3>
                  <p className="mb-2"><strong>ציוד:</strong> {selectedSignature.equipment_name}{selectedSignature.serial_number ? ` (צ': ${selectedSignature.serial_number})` : ''}</p>
                  <p className="mb-2"><strong>תאריך:</strong> {selectedSignature.signature_date} {selectedSignature.signature_time}</p>
                  <div className="border rounded-lg p-4 bg-slate-50 mb-4">
                    {selectedSignature.signature_data ? (
                      <img 
                        src={selectedSignature.signature_data} 
                        alt="חתימה דיגיטלית" 
                        className="w-full h-auto object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'block';
                          }
                        }}
                      />
                    ) : null}
                    <div style={{display: selectedSignature.signature_data ? 'none' : 'block'}} className="text-center text-gray-500 py-4">
                      לא ניתן להציג חתימה
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedSignature(null)}>
                      סגור
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="equipment" className="space-y-6">
            <div className="flex justify-end mb-6">
              <Button 
                onClick={exportEquipmentReport}
                disabled={equipmentData.length === 0 || equipmentLoading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Download className="w-4 h-4 mr-2" />
                יצוא דוח ציוד ({equipmentData.length})
              </Button>
            </div>

            {/* Date Range Selector for Equipment */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-purple-600" />
                  בחירת טווח תאריכים לדוח ציוד
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="equipment-start-date">מתאריך:</Label>
                    <Input
                      id="equipment-start-date"
                      type="date"
                      value={equipmentStartDate}
                      onChange={(e) => setEquipmentStartDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="equipment-end-date">עד תאריך:</Label>
                    <Input
                      id="equipment-end-date"
                      type="date"
                      value={equipmentEndDate}
                      onChange={(e) => setEquipmentEndDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Button onClick={loadEquipmentReport} disabled={equipmentLoading} className="bg-purple-600 hover:bg-purple-700">
                    {equipmentLoading ? "טוען..." : "הפק דוח ציוד"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  הדוח יציג ציוד לפי תאריך אישור אחרון או תאריך יצירה.
                </p>
              </CardContent>
            </Card>

            {/* Equipment Statistics */}
            {equipmentData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-8 h-8 text-purple-600" />
                      <div>
                        <p className="text-sm text-purple-600">סה"כ פריטים (עם צ')</p>
                        <p className="text-2xl font-bold text-purple-800">{equipmentData.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">עם אישור אחרון</p>
                        <p className="text-2xl font-bold text-green-800">
                          {equipmentData.filter(item => item.last_confirmation).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <User className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-blue-600">חיילים ייחודיים</p>
                        <p className="text-2xl font-bold text-blue-800">
                          {new Set(equipmentData.map(item => item.soldier_name).filter(Boolean)).size}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-8 h-8 text-orange-600" />
                      <div>
                        <p className="text-sm text-orange-600">ללא אישור</p>
                        <p className="text-2xl font-bold text-orange-800">
                          {equipmentData.filter(item => !item.last_confirmation).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Equipment Table */}
            <Card>
              <CardHeader>
                <CardTitle>דוח ציוד מפורט</CardTitle>
              </CardHeader>
              <CardContent>
                {equipmentLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>טוען דוח ציוד...</p>
                  </div>
                ) : equipmentData.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">בחר תאריכים להצגת דוח</h3>
                    <p className="text-slate-500">לחץ על "הפק דוח ציוד" כדי להציג נתונים</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-right">שם ציוד</TableHead>
                          <TableHead className="text-right">מספר צ'</TableHead>
                          <TableHead className="text-right">שם חייל</TableHead>
                          <TableHead className="text-right">מקום</TableHead>
                          <TableHead className="text-right">אישור אחרון</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipmentData.map((item, index) => (
                          <TableRow key={index} className="hover:bg-slate-50">
                            <TableCell className="font-medium">{item.equipment_name}</TableCell>
                            <TableCell className="font-mono">{item.serial_number || '-'}</TableCell>
                            <TableCell>{item.soldier_name || '-'}</TableCell>
                            <TableCell>{item.location || '-'}</TableCell>
                            <TableCell>
                              {item.last_confirmation ? (
                                <Badge className="bg-green-100 text-green-800">
                                  {new Date(item.last_confirmation).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500">
                                  לא אושר
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <EquipmentInventoryReport />
          </TabsContent>

          <TabsContent value="tracking" className="space-y-6">
            <EquipmentTrackingReport />
          </TabsContent>

          <TabsContent value="soldier-summary" className="space-y-6">
            <SoldierEquipmentSummary />
          </TabsContent>

          <TabsContent value="signed-summary" className="space-y-6">
            <SignedEquipmentSummary />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
