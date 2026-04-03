import React, { useMemo, useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Package, Plus, Mail, Eye, Save, User } from "lucide-react";
import { Equipment } from "@/entities/Equipment";
import { LocationSelectField, getLocationColor } from "./LocationSelect";


export default function AssignmentsTable({ 
  assignments, 
  equipmentTypes, 
  onDeleteSoldierAssignments, 
  onAddEquipmentToSoldier, 
  onSendConfirmationRequest,
  onShowSoldierDetails,
  onRefreshData
}) {
  const [localLocationEdits, setLocalLocationEdits] = useState({});
  const [localDetailsEdits, setLocalDetailsEdits] = useState({});
  const [savingLocations, setSavingLocations] = useState({});

  const handleLocationChange = useCallback((itemId, newLocation) => {
    setLocalLocationEdits(prev => ({ ...prev, [itemId]: newLocation }));
  }, []);

  const handleDetailsChange = useCallback((itemId, newDetails) => {
    setLocalDetailsEdits(prev => ({ ...prev, [itemId]: newDetails }));
  }, []);

  const getLocationValue = useCallback((item) => {
    return localLocationEdits[item.id] !== undefined ? localLocationEdits[item.id] : (item.location || "אצל החייל");
  }, [localLocationEdits]);

  const getDetailsValue = useCallback((item) => {
    return localDetailsEdits[item.id] !== undefined ? localDetailsEdits[item.id] : (item.location_details || "");
  }, [localDetailsEdits]);

  const soldierGroups = useMemo(() => {
    if (!Array.isArray(assignments)) return {};
    return assignments.reduce((acc, assignment) => {
      if (!assignment || !assignment.soldier_name) return acc;
      if (!acc[assignment.soldier_name]) {
        acc[assignment.soldier_name] = {
          items: [],
          soldier_id: assignment.soldier_id,
          soldier_email: assignment.soldier_email
        };
      }
      acc[assignment.soldier_name].items.push(assignment);
      return acc;
    }, {});
  }, [assignments]);

  const typesMap = useMemo(() => {
    if (!Array.isArray(equipmentTypes)) return new Map();
    return new Map(equipmentTypes.map(type => [type.id, type]));
  }, [equipmentTypes]);

  const hasSerialNumber = useCallback((item) => {
    const type = typesMap.get(item.equipment_type_id);
    return type && type.serial_number;
  }, [typesMap]);

  const handleSaveLocations = useCallback(async (soldierName, items) => {
    setSavingLocations(prev => ({ ...prev, [soldierName]: true }));
    
    try {
      const updatePromises = items
        .filter(item => localLocationEdits[item.id] !== undefined || localDetailsEdits[item.id] !== undefined)
        .map(item => {
          const updateData = {};
          if (localLocationEdits[item.id] !== undefined) updateData.location = localLocationEdits[item.id];
          if (localDetailsEdits[item.id] !== undefined) updateData.location_details = localDetailsEdits[item.id];
          return Equipment.update(item.id, updateData);
        });
      
      await Promise.all(updatePromises);
      
      setLocalLocationEdits(prev => {
        const updated = { ...prev };
        items.forEach(item => delete updated[item.id]);
        return updated;
      });
      setLocalDetailsEdits(prev => {
        const updated = { ...prev };
        items.forEach(item => delete updated[item.id]);
        return updated;
      });
      
      if (onRefreshData) onRefreshData();
      
    } catch (error) {
      console.error("Error updating locations:", error);
      alert("שגיאה בעדכון המקומות");
    } finally {
      setSavingLocations(prev => ({ ...prev, [soldierName]: false }));
    }
  }, [localLocationEdits, localDetailsEdits, onRefreshData]);

  const hasLocationChanges = useCallback((items) => {
    return items.some(item => localLocationEdits[item.id] !== undefined || localDetailsEdits[item.id] !== undefined);
  }, [localLocationEdits, localDetailsEdits]);

  const soldierEntries = Object.entries(soldierGroups);

  if (soldierEntries.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">אין שיוכי ציוד</h3>
        <p className="text-slate-500">התחל בשיוך הציוד הראשון לחייל</p>
      </div>
    );
  }

  // תצוגה במובייל - כרטיסים
  const MobileView = () => (
    <div className="block md:hidden space-y-4">
      {soldierEntries.map(([soldierName, data]) => (
        <Card key={soldierName} className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">{soldierName}</span>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {data.items.length} פריטים
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">ציוד משויך:</h4>
              {data.items.map(item => {
                const type = typesMap.get(item.equipment_type_id);
                return (
                  <div key={`mobile-item-${item.id}`} className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      {type ? type.name : 'לא ידוע'}
                      {type && type.serial_number ? ` (צ': ${type.serial_number})` : ''}
                    </Badge>
                    {hasSerialNumber(item) && (
                      <div className="space-y-1">
                        <LocationSelectField
                          size="sm"
                          value={getLocationValue(item)}
                          onChange={(val) => handleLocationChange(item.id, val)}
                          details={getDetailsValue(item)}
                          onDetailsChange={(val) => handleDetailsChange(item.id, val)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="h-9">
                {hasLocationChanges(data.items) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => handleSaveLocations(soldierName, data.items)}
                    disabled={savingLocations[soldierName]}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingLocations[soldierName] ? "שומר..." : "עדכן מקומות"}
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 hover:bg-blue-50"
                  onClick={() => onShowSoldierDetails(soldierName)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  פרטים
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 hover:bg-green-50"
                  onClick={() => onAddEquipmentToSoldier(soldierName, data.soldier_id, data.soldier_email)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  הוסף ציוד
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 hover:bg-blue-50"
                  onClick={() => onSendConfirmationRequest(soldierName, data.soldier_email)}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  שלח תזכורת
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => onDeleteSoldierAssignments(soldierName)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  מחק הכל
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // תצוגה בדסקטופ - טבלה
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            <TableHead className="text-right font-semibold">שם החייל</TableHead>
            <TableHead className="text-right font-semibold">ציוד משויך</TableHead>
            <TableHead className="text-right font-semibold">מקום</TableHead>
            <TableHead className="text-right font-semibold">כמות</TableHead>
            <TableHead className="text-right font-semibold">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {soldierEntries.map(([soldierName, data]) => (
            <TableRow key={`desktop-row-${soldierName}`} className="hover:bg-slate-50/50">
              <TableCell className="font-semibold text-slate-800 align-top">
                {soldierName}
              </TableCell>
              <TableCell className="align-top">
                <div className="space-y-2">
                  {data.items.map(item => {
                    const type = typesMap.get(item.equipment_type_id);
                    return (
                      <div key={`desktop-item-${item.id}`} className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {type ? type.name : 'לא ידוע'}
                          {type && type.serial_number ? ` (צ': ${type.serial_number})` : ''}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="space-y-2">
                  {data.items.map(item => (
                    <div key={`desktop-location-wrapper-${item.id}`}>
                      {hasSerialNumber(item) ? (
                        <div className="flex items-center gap-1">
                          <LocationSelectField
                            size="sm"
                            value={getLocationValue(item)}
                            onChange={(val) => handleLocationChange(item.id, val)}
                            details={getDetailsValue(item)}
                            onDetailsChange={(val) => handleDetailsChange(item.id, val)}
                          />
                        </div>
                      ) : (
                        <Badge className={`text-xs ${getLocationColor(getLocationValue(item))}`}>
                          {getLocationValue(item) || "אצל החייל"}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <Button
                  variant="ghost"
                  className="text-lg font-bold text-blue-600 hover:bg-blue-50 p-2 rounded-lg cursor-pointer"
                  onClick={() => onShowSoldierDetails(soldierName)}
                >
                  {data.items.length}
                </Button>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex gap-1 flex-wrap items-center">
                   <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-2 hover:bg-green-100 transition-opacity duration-200 ${hasLocationChanges(data.items) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => handleSaveLocations(soldierName, data.items)}
                    disabled={savingLocations[soldierName] || !hasLocationChanges(data.items)}
                    title="שמור שינויים במקומות"
                  >
                    <Save className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 text-xs font-semibold mr-1">
                      {savingLocations[soldierName] ? "שומר..." : "עדכן"}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-slate-100"
                    onClick={() => onShowSoldierDetails(soldierName)}
                    title="הצג פרטי ציוד"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                    onClick={() => onSendConfirmationRequest(soldierName, data.soldier_email)}
                    title="שלח בקשה לאישור מחודש"
                  >
                    <Mail className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-green-100"
                    onClick={() => onAddEquipmentToSoldier(soldierName, data.soldier_id, data.soldier_email)}
                    title="הוסף ציוד נוסף"
                  >
                    <Plus className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-red-100"
                    onClick={() => onDeleteSoldierAssignments(soldierName)}
                    title="מחק את כל הציוד"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <MobileView />
      <DesktopView />
    </>
  );
}