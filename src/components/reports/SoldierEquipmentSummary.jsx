import React, { useState, useEffect } from "react";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, Package, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SoldierEquipmentSummary() {
  const [soldiersSummary, setSoldiersSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummaryData();
  }, []);

  const loadSummaryData = async () => {
    setLoading(true);
    try {
      const [allEquipment, allEquipmentTypes] = await Promise.all([
        Equipment.filter({ status: 'active' }),
        EquipmentType.list()
      ]);

      // יצירת מפה של סוגי ציוד
      const typesMap = new Map(allEquipmentTypes.map(type => [type.id, type]));

      // קיבוץ לפי חייל
      const soldierEquipmentMap = new Map();

      allEquipment.forEach(eq => {
        const soldierName = eq.soldier_name || 'לא משויך';
        
        if (!soldierEquipmentMap.has(soldierName)) {
          soldierEquipmentMap.set(soldierName, new Map());
        }

        const soldierEquipment = soldierEquipmentMap.get(soldierName);
        const type = typesMap.get(eq.equipment_type_id);
        const typeName = type?.name || 'לא ידוע';

        if (!soldierEquipment.has(typeName)) {
          soldierEquipment.set(typeName, 0);
        }
        
        soldierEquipment.set(typeName, soldierEquipment.get(typeName) + 1);
      });

      // המרה למבנה נוח לתצוגה
      const summaryArray = Array.from(soldierEquipmentMap.entries()).map(([soldierName, equipmentMap]) => {
        const equipmentList = Array.from(equipmentMap.entries())
          .map(([typeName, count]) => ({ name: typeName, count }))
          .sort((a, b) => a.name.localeCompare(b.name, 'he'));

        const totalItems = equipmentList.reduce((sum, item) => sum + item.count, 0);

        return {
          soldierName,
          equipment: equipmentList,
          totalItems
        };
      }).sort((a, b) => a.soldierName.localeCompare(b.soldierName, 'he'));

      setSoldiersSummary(summaryArray);

    } catch (error) {
      console.error("Error loading soldier equipment summary:", error);
      alert("שגיאה בטעינת סיכום ציוד לפי חייל");
      setSoldiersSummary([]);
    }
    setLoading(false);
  };

  const exportToExcel = () => {
    if (soldiersSummary.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const exportData = soldiersSummary.flatMap(soldier => {
      // שורה ראשונה לחייל - עם סה"כ
      const rows = [
        {
          'שם חייל': soldier.soldierName,
          'סוג ציוד': '=== סה"כ פריטים ===',
          'כמות': soldier.totalItems
        }
      ];

      // שורות של ציוד ספציפי
      soldier.equipment.forEach(item => {
        rows.push({
          'שם חייל': '',
          'סוג ציוד': item.name,
          'כמות': item.count
        });
      });

      // שורה ריקה להפרדה
      rows.push({
        'שם חייל': '',
        'סוג ציוד': '',
        'כמות': ''
      });

      return rows;
    });

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => {
        const value = row[header] === undefined || row[header] === null ? '' : String(row[header]);
        return `"${value.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `סיכום_ציוד_לפי_חייל_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">סיכום ציוד לפי חייל</h2>
          <p className="text-slate-600 mt-1">כמות פריטים מכל סוג עבור כל חייל</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={loadSummaryData}
            disabled={loading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'טוען...' : 'רענן'}
          </Button>
          <Button
            onClick={exportToExcel}
            disabled={soldiersSummary.length === 0 || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            יצוא לאקסל ({soldiersSummary.length} חיילים)
          </Button>
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">סה"כ חיילים</p>
                <p className="text-2xl font-bold text-blue-800">{soldiersSummary.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-600">סה"כ פריטי ציוד</p>
                <p className="text-2xl font-bold text-green-800">
                  {soldiersSummary.reduce((sum, s) => sum + s.totalItems, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-purple-600">ממוצע פריטים לחייל</p>
                <p className="text-2xl font-bold text-purple-800">
                  {soldiersSummary.length > 0 
                    ? (soldiersSummary.reduce((sum, s) => sum + s.totalItems, 0) / soldiersSummary.length).toFixed(1)
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* טבלת סיכום */}
      <Card>
        <CardHeader>
          <CardTitle>פירוט ציוד לכל חייל</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p>טוען נתונים...</p>
            </div>
          ) : soldiersSummary.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">אין נתונים להצגה</h3>
              <p className="text-slate-500">לא נמצא ציוד משויך לחיילים</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right font-bold">שם חייל</TableHead>
                    <TableHead className="text-right font-bold">סה"כ פריטים</TableHead>
                    <TableHead className="text-right font-bold">פירוט ציוד</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soldiersSummary.map((soldier, index) => (
                    <TableRow key={index} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-800 align-top">
                        {soldier.soldierName}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge className="bg-blue-100 text-blue-800 text-base px-3 py-1">
                          {soldier.totalItems}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {soldier.equipment.map((item, itemIndex) => (
                            <div 
                              key={itemIndex} 
                              className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"
                            >
                              <span className="font-bold text-green-600 text-lg min-w-[30px]">
                                {item.count}
                              </span>
                              <span className="text-slate-700">×</span>
                              <span className="font-medium text-slate-800">{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}