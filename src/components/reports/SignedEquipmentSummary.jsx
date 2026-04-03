import React, { useState, useEffect } from "react";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { EquipmentInventory } from "@/entities/EquipmentInventory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Download, Package, RefreshCw, CheckCircle, AlertTriangle, AlertCircle, Save, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SignedEquipmentSummary() {
  const [equipmentSummary, setEquipmentSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [inventoryEdits, setInventoryEdits] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSignatureSummary();
  }, []);

  const loadSignatureSummary = async () => {
    setLoading(true);
    try {
      const [allAssignments, allEquipmentTypes, allInventory] = await Promise.all([
        Equipment.list(),
        EquipmentType.list(),
        EquipmentInventory.list()
      ]);

      // יצירת מפה של מלאי
      const inventoryMap = new Map(allInventory.map(inv => [inv.equipment_type_name, inv.total_quantity]));

      // יצירת מפה של סוגי ציוד
      const typesMap = new Map(allEquipmentTypes.map(type => [type.id, type]));

      // ספירת כמויות לפי שם ציוד - עובר חייל חייל וסופר מה יש לו
      const quantitiesMap = new Map();
      
      allAssignments.forEach(assignment => {
        const equipmentType = typesMap.get(assignment.equipment_type_id);
        
        if (equipmentType && equipmentType.name) {
          const equipmentName = equipmentType.name.trim();
          
          if (quantitiesMap.has(equipmentName)) {
            const existing = quantitiesMap.get(equipmentName);
            quantitiesMap.set(equipmentName, {
              ...existing,
              count: existing.count + 1,
              soldiers: existing.soldiers.add(assignment.soldier_name)
            });
          } else {
            quantitiesMap.set(equipmentName, {
              typeName: equipmentName,
              count: 1,
              soldiers: new Set([assignment.soldier_name]),
              totalInventory: inventoryMap.get(equipmentName) || null
            });
          }
        }
      });

      // הוספת סוגי ציוד שיש להם מלאי אבל אין שיוכים
      allInventory.forEach(inv => {
        if (!quantitiesMap.has(inv.equipment_type_name)) {
          quantitiesMap.set(inv.equipment_type_name, {
            typeName: inv.equipment_type_name,
            count: 0,
            soldiers: new Set(),
            totalInventory: inv.total_quantity
          });
        }
      });

      // המרה למערך ומיון
      const summaryArray = Array.from(quantitiesMap.values())
        .map(item => ({
          typeName: item.typeName,
          count: item.count,
          soldiersCount: item.soldiers.size,
          totalInventory: item.totalInventory,
          status: getInventoryStatus(item.count, item.totalInventory)
        }))
        .sort((a, b) => {
          if (a.status !== b.status) {
            const statusOrder = { 'excess': 0, 'missing': 1, 'complete': 2, 'no_inventory': 3 };
            return statusOrder[a.status] - statusOrder[b.status];
          }
          return b.count - a.count;
        });

      setEquipmentSummary(summaryArray);
      setInventoryEdits({});

    } catch (error) {
      console.error("Error loading signed equipment summary:", error);
      alert("שגיאה בטעינת סיכום ציוד חתום");
      setEquipmentSummary([]);
    }
    setLoading(false);
  };

  const getInventoryStatus = (signed, inventory) => {
    if (!inventory || inventory === 0) return 'no_inventory';
    if (signed > inventory) return 'excess';
    if (signed < inventory) return 'missing';
    return 'complete';
  };

  const getStatusBadge = (status, signed, inventory) => {
    switch(status) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800 border-green-300">✓ הכל חתום</Badge>;
      case 'missing':
        return <Badge className="bg-red-100 text-red-800 border-red-300">⚠ חסרים {inventory - signed}</Badge>;
      case 'excess':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">⚡ עודף {signed - inventory}</Badge>;
      case 'no_inventory':
        return <Badge variant="outline" className="text-slate-500">לא הוגדר</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'missing':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'excess':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Package className="w-5 h-5 text-slate-400" />;
    }
  };

  const handleInventoryEdit = (typeName, value) => {
    setInventoryEdits(prev => ({
      ...prev,
      [typeName]: value === '' ? '' : parseInt(value) || 0
    }));
  };

  const saveInventory = async () => {
    setSaving(true);
    try {
      const allInventory = await EquipmentInventory.list();
      const inventoryMap = new Map(allInventory.map(inv => [inv.equipment_type_name, inv]));

      // עדכון או יצירת רשומות מלאי
      for (const item of equipmentSummary) {
        const newQuantity = inventoryEdits[item.typeName] !== undefined 
          ? inventoryEdits[item.typeName] 
          : item.totalInventory;

        if (newQuantity === null || newQuantity === '') continue;

        const existingInventory = inventoryMap.get(item.typeName);

        if (existingInventory) {
          // עדכון
          if (existingInventory.total_quantity !== newQuantity) {
            await EquipmentInventory.update(existingInventory.id, {
              total_quantity: newQuantity
            });
          }
        } else if (newQuantity > 0) {
          // יצירה חדשה
          await EquipmentInventory.create({
            equipment_type_name: item.typeName,
            total_quantity: newQuantity
          });
        }
      }

      alert("המלאי נשמר בהצלחה! ✅");
      setEditMode(false);
      await loadSignatureSummary();

    } catch (error) {
      console.error("Error saving inventory:", error);
      alert("שגיאה בשמירת המלאי");
    }
    setSaving(false);
  };

  const exportToExcel = () => {
    if (equipmentSummary.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const exportData = equipmentSummary.map(item => ({
      'סוג ציוד': item.typeName,
      'משויכים': item.count,
      'מלאי כולל': item.totalInventory || 'לא מוגדר',
      'הפרש': item.totalInventory ? (item.count - item.totalInventory) : '-',
      'סטטוס': item.totalInventory 
        ? (item.count === item.totalInventory ? 'הכל משויך' : item.count > item.totalInventory ? 'עודף' : 'חסרים')
        : 'אין מלאי',
      'חיילים': item.soldiersCount
    }));

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
    link.setAttribute('download', `סיכום_ציוד_משויך_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalSignedItems = equipmentSummary.reduce((sum, item) => sum + item.count, 0);
  const totalInventoryItems = equipmentSummary.reduce((sum, item) => sum + (item.totalInventory || 0), 0);
  const completeItems = equipmentSummary.filter(item => item.status === 'complete').length;
  const missingItems = equipmentSummary.filter(item => item.status === 'missing').length;
  const excessItems = equipmentSummary.filter(item => item.status === 'excess').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">סיכום ציוד משויך מול מלאי</h2>
          <p className="text-slate-600 mt-1">ספירת כל פריטי הציוד המשויכים לחיילים</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={loadSignatureSummary}
            disabled={loading || editMode}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'טוען...' : 'רענן'}
          </Button>
          {!editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                className="border-blue-300 hover:bg-blue-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                ערוך מלאי
              </Button>
              <Button
                onClick={exportToExcel}
                disabled={equipmentSummary.length === 0 || loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                יצוא לאקסל
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false);
                  setInventoryEdits({});
                }}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button
                onClick={saveInventory}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'שומר...' : 'שמור מלאי'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-600">הכל משויך</p>
                <p className="text-2xl font-bold text-green-800">{completeItems}</p>
                <p className="text-xs text-green-600 mt-1">סוגי ציוד</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-red-600">חסרים שיוכים</p>
                <p className="text-2xl font-bold text-red-800">{missingItems}</p>
                <p className="text-xs text-red-600 mt-1">סוגי ציוד</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-yellow-600">עודף שיוכים</p>
                <p className="text-2xl font-bold text-yellow-800">{excessItems}</p>
                <p className="text-xs text-yellow-600 mt-1">סוגי ציוד</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">סה"כ משויך/מלאי</p>
                <p className="text-2xl font-bold text-blue-800">
                  {totalSignedItems}/{totalInventoryItems}
                </p>
                <p className="text-xs text-blue-600 mt-1">פריטים</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* הודעת הסבר */}
      {editMode && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Edit className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-800">מצב עריכת מלאי</p>
                <p className="text-sm text-blue-700 mt-1">
                  הזן את כמות המלאי הכולל לכל סוג ציוד בעמודת "מלאי כולל". המערכת תשמור את הנתונים ותציג השוואה אוטומטית.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* טבלת סיכום */}
      <Card>
        <CardHeader>
          <CardTitle>פירוט ציוד משויך מול מלאי</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p>טוען נתונים...</p>
            </div>
          ) : equipmentSummary.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">אין ציוד משויך במערכת</h3>
              <p className="text-slate-500">לא נמצאו שיוכי ציוד</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right font-bold">#</TableHead>
                    <TableHead className="text-right font-bold">סוג ציוד</TableHead>
                    <TableHead className="text-right font-bold">משויכים</TableHead>
                    <TableHead className="text-right font-bold">מלאי כולל</TableHead>
                    <TableHead className="text-right font-bold">הפרש</TableHead>
                    <TableHead className="text-right font-bold">סטטוס</TableHead>
                    <TableHead className="text-right font-bold">חיילים</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipmentSummary.map((item, index) => {
                    const currentInventory = inventoryEdits[item.typeName] !== undefined 
                      ? inventoryEdits[item.typeName] 
                      : item.totalInventory;
                    const diff = currentInventory ? item.count - currentInventory : null;
                    
                    return (
                      <TableRow key={index} className="hover:bg-slate-50">
                        <TableCell className="font-semibold text-slate-600">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {item.typeName}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800 text-base px-3 py-1 font-bold">
                            {item.count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {editMode ? (
                            <Input
                              type="number"
                              min="0"
                              value={inventoryEdits[item.typeName] !== undefined ? inventoryEdits[item.typeName] : (item.totalInventory || '')}
                              onChange={(e) => handleInventoryEdit(item.typeName, e.target.value)}
                              className="w-24 text-center"
                              placeholder="0"
                            />
                          ) : currentInventory ? (
                            <Badge variant="outline" className="text-slate-700 text-base px-3 py-1">
                              {currentInventory}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-sm">לא מוגדר</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {diff !== null ? (
                            <span className={`font-bold text-base ${
                              diff === 0 ? 'text-green-600' : 
                              diff > 0 ? 'text-yellow-600' : 
                              'text-red-600'
                            }`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(
                            getInventoryStatus(item.count, currentInventory), 
                            item.count, 
                            currentInventory
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-blue-700 border-blue-300">
                            {item.soldiersCount}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}