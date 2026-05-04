import React, { useState, useEffect } from "react";
import { EquipmentType } from "@/entities/EquipmentType";
import { Equipment } from "@/entities/Equipment";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import EquipmentTypesTable from "../components/equipment-types/EquipmentTypesTable";
import AddEquipmentTypeDialog from "../components/equipment-types/AddEquipmentTypeDialog";

export default function EquipmentTypes() {
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingType, setEditingType] = useState(null);

  useEffect(() => {
    loadEquipmentTypes();
  }, []);

  const loadEquipmentTypes = async () => {
    setLoading(true);
    try {
      const data = await EquipmentType.list("-created_date");
      setEquipmentTypes(data || []);
    } catch (error) {
      console.error("Error loading equipment types:", error);
      setEquipmentTypes([]);
    }
    setLoading(false);
  };

  const handleAddType = async (typeData) => {
    try {
      await EquipmentType.create(typeData);
      setShowAddDialog(false);
      setEditingType(null);
      loadEquipmentTypes();
    } catch (error) {
      console.error("Error adding equipment type:", error);
    }
  };

  const handleUpdateType = async (id, typeData) => {
    try {
      await EquipmentType.update(id, typeData);
      setShowAddDialog(false);
      setEditingType(null);
      loadEquipmentTypes();
    } catch (error) {
      console.error("Error updating equipment type:", error);
    }
  };

  const handleDeleteType = async (id) => {
    try {
      const associatedEquipment = await Equipment.filter({ equipment_type_id: id }) || [];

      if (associatedEquipment.length > 0) {
        const soldierNames = [...new Set(associatedEquipment.map(e => e.soldier_name))].join(', ');
        const confirmation = window.confirm(
          `סוג ציוד זה משויך ל-${associatedEquipment.length} פריטים השייכים לחייל(ם): ${soldierNames}.\n\nמחיקת סוג ציוד זה תמחק אותו מהמלאי וגם תסיר את כל השיוכים שלו מהחיילים.\n\nהאם אתה בטוח שברצונך להמשיך?`
        );

        if (confirmation) {
          // First, delete all associated equipment assignments
          const deletePromises = associatedEquipment.map(eq => Equipment.delete(eq.id));
          await Promise.all(deletePromises);
          
          // Then, delete the equipment type itself
          await EquipmentType.delete(id);
          
          loadEquipmentTypes();
        }
      } else {
        // If no equipment is associated, just confirm and delete the type
        if (window.confirm("האם אתה בטוח שברצונך למחוק סוג ציוד זה?")) {
          await EquipmentType.delete(id);
          loadEquipmentTypes();
        }
      }
    } catch (error) {
      console.error("Error deleting equipment type and its assignments:", error);
      alert("אירעה שגיאה במחיקת הציוד.");
    }
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setShowAddDialog(true);
  };

  const exportToExcel = () => {
    const exportData = equipmentTypes.map(item => ({
      'שם הציוד': item.name,
      'תיאור': item.description || '',
      'דגם': item.model || '',
      'פעיל': item.is_active ? 'כן' : 'לא',
      'תאריך יצירה': new Date(item.created_date).toLocaleDateString('he-IL')
    }));

    const headers = Object.keys(exportData[0] || {});
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
    link.setAttribute('download', `equipment_types_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-1">סוגי ציוד</h1>
            <p className="text-slate-600 text-xs sm:text-sm">ניהול רשימת סוגי הציוד במערכת</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={equipmentTypes.length === 0}
              className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-50 text-xs sm:text-sm"
            >
              <Download className="w-4 h-4 ml-1 sm:mr-2" />
              יצוא
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 ml-1 sm:mr-2" />
              הוסף סוג ציוד
            </Button>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <CardTitle className="text-xl font-bold text-slate-800">
              רשימת סוגי ציוד ({equipmentTypes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <EquipmentTypesTable
              equipmentTypes={equipmentTypes}
              loading={loading}
              onEdit={handleEdit}
              onDelete={handleDeleteType}
            />
          </CardContent>
        </Card>

        <AddEquipmentTypeDialog
          open={showAddDialog}
          onOpenChange={(isOpen) => {
             if (!isOpen) setEditingType(null);
             setShowAddDialog(isOpen);
          }}
          onSave={editingType ? 
            (data) => handleUpdateType(editingType.id, data) : 
            handleAddType
          }
          editingType={editingType}
        />
      </div>
    </div>
  );
}