
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Input is no longer used for search, but might be used elsewhere or kept for future expansion. Not removed based on outline.
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { History, Search, Download, Package, ArrowRight, User, Calendar, MapPin } from "lucide-react"; // Search icon is no longer used for the input.
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType";
import { EquipmentSignature } from "@/entities/EquipmentSignature";
import { SystemLog } from "@/entities/SystemLog";

export default function EquipmentTrackingReport() {
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(false);
  // searchTerm state and related logic are removed as per the outline.

  useEffect(() => {
    loadEquipmentTypes();
  }, []);

  const loadEquipmentTypes = async () => {
    try {
      const types = await EquipmentType.list();
      // Filter only equipment with serial numbers
      const withSerialNumbers = types.filter(type => type.serial_number);
      setEquipmentTypes(withSerialNumbers || []);
    } catch (error) {
      console.error("Error loading equipment types:", error);
      setEquipmentTypes([]);
    }
  };

  const loadTrackingData = async (equipmentTypeId) => {
    if (!equipmentTypeId) return;
    
    setLoading(true);
    try {
      // Get the equipment type details
      const equipmentType = equipmentTypes.find(et => et.id === equipmentTypeId);
      if (!equipmentType) return;

      // Get all assignments for this equipment type (current and historical)
      const allAssignments = await Equipment.list();
      const equipmentAssignments = allAssignments.filter(eq => eq.equipment_type_id === equipmentTypeId);
      
      // Get all signatures for this equipment
      const allSignatures = await EquipmentSignature.list();
      const equipmentSignatures = allSignatures.filter(sig => 
        sig.equipment_items?.some(item => item.equipment_type_id === equipmentTypeId)
      );

      // Build timeline
      const timeline = [];

      // Add assignment events
      equipmentAssignments.forEach(assignment => {
        timeline.push({
          type: 'assignment',
          date: assignment.created_date,
          soldier_name: assignment.soldier_name,
          soldier_id: assignment.soldier_id,
          location: assignment.location,
          status: assignment.status,
          data: assignment
        });
      });

      // Add signature events
      equipmentSignatures.forEach(signature => {
        timeline.push({
          type: 'signature',
          date: signature.signature_date,
          time: signature.signature_time,
          soldier_name: signature.soldier_name,
          soldier_id: signature.soldier_id,
          status: signature.status,
          data: signature
        });
      });

      // Sort by date
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      setTrackingData({
        equipmentType,
        timeline,
        currentStatus: equipmentAssignments.find(eq => eq.status === 'active') || null
      });

    } catch (error) {
      console.error("Error loading tracking data:", error);
      alert("שגיאה בטעינת נתוני המעקב");
    }
    setLoading(false);
  };

  const exportTrackingReport = () => {
    if (!trackingData.timeline || trackingData.timeline.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const exportData = trackingData.timeline.map(event => ({
      'תאריך': new Date(event.date).toLocaleDateString('he-IL'),
      'שעה': event.time || new Date(event.date).toLocaleTimeString('he-IL'),
      'סוג פעולה': event.type === 'assignment' ? 'שיוך' : 'חתימה',
      'שם חייל': event.soldier_name || '',
      'מספר אישי': event.soldier_id || '',
      'מקום': event.location || '',
      'סטטוס': event.status || ''
    }));

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      `"מעקב מכשיר: ${trackingData.equipmentType.name} (צ': ${trackingData.equipmentType.serial_number})"`,
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
    link.setAttribute('download', `מעקב_מכשיר_${trackingData.equipmentType.serial_number}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // filteredEquipmentTypes is removed as search is removed.

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            מעקב מכשירים
          </h2>
          <p className="text-slate-600">מעקב אחר מסע המכשיר לאורך כל חייו</p>
        </div>
        {trackingData.timeline && (
          <Button onClick={exportTrackingReport} className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            יצוא מעקב
          </Button>
        )}
      </div>

      {/* Equipment Selector */}
      <Card>
        <CardHeader>
          <CardTitle>בחירת מכשיר למעקב</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Label htmlFor="select-equipment">בחר מכשיר</Label>
            <Select 
              value={selectedEquipmentId} 
              onValueChange={(value) => {
                setSelectedEquipmentId(value);
                loadTrackingData(value);
              }}
            >
              <SelectTrigger id="select-equipment">
                <SelectValue placeholder="בחר מכשיר למעקב..." />
              </SelectTrigger>
              <SelectContent>
                {equipmentTypes.map(et => ( // Now directly mapping over equipmentTypes
                  <SelectItem key={et.id} value={et.id}>
                    {et.name} (צ': {et.serial_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>טוען נתוני מעקב...</p>
          </CardContent>
        </Card>
      )}

      {/* Tracking Results */}
      {trackingData.equipmentType && !loading && (
        <div className="space-y-6">
          {/* Equipment Info */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />
                {trackingData.equipmentType.name}
              </CardTitle>
              <div className="flex gap-4 text-sm text-slate-600">
                <span>מספר צ': <strong>{trackingData.equipmentType.serial_number}</strong></span>
                {trackingData.currentStatus && (
                  <>
                    <span>נוכחי אצל: <strong>{trackingData.currentStatus.soldier_name}</strong></span>
                    <span>מקום: <strong>{trackingData.currentStatus.location || 'לא צוין'}</strong></span>
                  </>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>מסע המכשיר</CardTitle>
            </CardHeader>
            <CardContent>
              {trackingData.timeline.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">אין היסטוריה</h3>
                  <p className="text-slate-500">לא נמצא מעקב עבור מכשיר זה</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {trackingData.timeline.map((event, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {event.type === 'assignment' ? (
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={event.type === 'assignment' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                            {event.type === 'assignment' ? 'שיוך' : 'חתימה'}
                          </Badge>
                          <span className="text-sm text-slate-500">
                            {new Date(event.date).toLocaleDateString('he-IL')}
                            {event.time && ` בשעה ${event.time}`}
                          </span>
                        </div>
                        
                        <div className="mt-2">
                          <p className="font-semibold text-slate-800">
                            {event.soldier_name}
                            {event.soldier_id && ` (${event.soldier_id})`}
                          </p>
                          
                          {event.location && (
                            <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </p>
                          )}
                          
                          {event.status && event.status !== 'active' && (
                            <Badge variant="outline" className="mt-1">
                              {event.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {index < trackingData.timeline.length - 1 && (
                        <div className="flex-shrink-0">
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!selectedEquipmentId && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">בחר מכשיר למעקב</h3>
            <p className="text-slate-500">
              בחר מכשיר מהרשימה למעלה כדי לראות את מסע המכשיר לאורך זמן
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
