
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Package, BarChart3, RefreshCw } from "lucide-react";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";

export default function EquipmentInventoryReport() {
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      // טעינת כל השיוכים וסוגי הציוד
      const [allAssignments, allEquipmentTypes] = await Promise.all([
        Equipment.list(),
        EquipmentType.list()
      ]);

      // יצירת מפה של סוגי ציוד
      const typesMap = new Map(allEquipmentTypes.map(type => [type.id, type]));

      // ספירת כמויות לפי שם ציוד (ולא לפי ID)
      const quantitiesMap = new Map();
      
      allAssignments.forEach(assignment => {
        const equipmentType = typesMap.get(assignment.equipment_type_id);
        
        if (equipmentType && equipmentType.name) {
          const equipmentName = equipmentType.name.trim(); // איחוד לפי שם
          
          if (quantitiesMap.has(equipmentName)) {
            const existing = quantitiesMap.get(equipmentName);
            quantitiesMap.set(equipmentName, {
              ...existing,
              quantity: existing.quantity + 1
            });
          } else {
            quantitiesMap.set(equipmentName, {
              name: equipmentName,
              model: equipmentType.model || '',
              isActive: equipmentType.is_active !== false,
              quantity: 1
            });
          }
        }
      });

      // המרה למערך וסידור לפי כמות
      const inventoryArray = Array.from(quantitiesMap.values())
        .sort((a, b) => b.quantity - a.quantity); // סידור לפי כמות יורדת

      setInventoryData(inventoryArray);
      setTotalItems(inventoryArray.reduce((sum, item) => sum + item.quantity, 0));
      
    } catch (error) {
      console.error("Error loading inventory data:", error);
      setInventoryData([]);
      setTotalItems(0);
    }
    setLoading(false);
  };

  const exportInventoryReport = () => {
    if (inventoryData.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const exportData = inventoryData.map(item => ({
      'שם ציוד': item.name,
      'כמות': item.quantity,
      'דגם': item.model || ''
    }));

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      `"דוח ציודים - ${new Date().toLocaleDateString('he-IL')}"`,
      `"סה״כ פריטים: ${totalItems}"`,
      '',
      headers.join(','),
      ...exportData.map(row => headers.map(header => {
        let value = row[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `דוח_ציודים_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-green-600" />
            דוח ציודים
          </h2>
          <p className="text-slate-600">סיכום כמויות של כל סוג ציוד במערכת</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={loadInventoryData} 
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
          <Button 
            onClick={exportInventoryReport} 
            disabled={inventoryData.length === 0 || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            יצוא דוח ({inventoryData.length})
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-600">סה״כ פריטים</p>
                <p className="text-2xl font-bold text-green-800">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">סוגי ציוד</p>
                <p className="text-2xl font-bold text-blue-800">{inventoryData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>פירוט כמויות ציוד</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p>טוען נתוני מלאי...</p>
            </div>
          ) : inventoryData.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">אין נתוני מלאי</h3>
              <p className="text-slate-500">לא נמצא ציוד משויך במערכת</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right font-semibold">שם ציוד</TableHead>
                    <TableHead className="text-right font-semibold">כמות</TableHead>
                    <TableHead className="text-right font-semibold">דגם</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryData.map((item, index) => (
                    <TableRow key={`${item.name}-${index}`} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-800">
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`font-bold text-lg ${
                            item.quantity > 10 ? 'bg-green-100 text-green-800' :
                            item.quantity > 5 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.model || '-'}</TableCell>
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
