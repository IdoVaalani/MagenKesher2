
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Package, CheckCircle, AlertCircle, FileWarning, Clock, Calendar } from "lucide-react";

// Helper function to safely format dates
const safeFormatDate = (dateInput) => {
  if (!dateInput) return 'לא זמין';
  
  try {
    // If it's already a formatted string that includes time, assume it's just a time string
    // and return it as is. This handles cases where confirmationTime is already formatted.
    if (typeof dateInput === 'string' && dateInput.includes(':')) {
      return dateInput;
    }
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return 'תאריך לא תקין';
    }
    
    return date.toLocaleDateString('he-IL');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'שגיאה בתאריך';
  }
};

export default function DetailsDialog({ open, onOpenChange, dialogData, dialogType }) {
  if (!dialogData) return null;

  const getDialogConfig = () => {
    switch (dialogType) {
      case 'soldiers':
        return {
          title: `סה״כ חיילים (${dialogData.length})`,
          icon: <Users className="w-5 h-5 text-blue-600" />
        };
      case 'equipment':
        return {
          title: `פריטי ציוד פעילים (${dialogData.length})`,
          icon: <Package className="w-5 h-5 text-green-600" />
        };
      case 'confirmed':
        return {
          title: `חיילים שאישרו היום (${dialogData.length})`,
          icon: <CheckCircle className="w-5 h-5 text-emerald-600" />
        };
      case 'pending':
        return {
          title: `ממתינים לאישור (${dialogData.length})`,
          icon: <AlertCircle className="w-5 h-5 text-orange-600" />
        };
      case 'reports':
        return {
          title: `פניות פתוחות (${dialogData.length})`,
          icon: <FileWarning className="w-5 h-5 text-amber-600" />
        };
      default:
        return { title: 'פרטים', icon: null };
    }
  };

  const { title, icon } = getDialogConfig();

  const renderContent = () => {
    switch (dialogType) {
      case 'soldiers':
        return (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם החייל</TableHead>
                  <TableHead className="text-right">כמות ציוד</TableHead>
                  <TableHead className="text-right">סטטוס היום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((soldier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{soldier.name}</TableCell>
                    <TableCell>{soldier.equipmentCount}</TableCell>
                    <TableCell>
                      <Badge className={soldier.confirmed ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                        {soldier.confirmed ? 'אישר' : 'ממתין'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );

      case 'equipment':
        return (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם הציוד</TableHead>
                  <TableHead className="text-right">מספר צ'</TableHead>
                  <TableHead className="text-right">חייל</TableHead>
                  <TableHead className="text-right">מיקום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((equipment, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{equipment.name}</TableCell>
                    <TableCell className="font-mono">{equipment.serialNumber || '-'}</TableCell>
                    <TableCell>{equipment.soldierName}</TableCell>
                    <TableCell>{equipment.location || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );

      case 'confirmed':
        return (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם החייל</TableHead>
                  <TableHead className="text-right">שעת אישור</TableHead>
                  <TableHead className="text-right">כמות ציוד</TableHead>
                  <TableHead className="text-right">דיווח</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((soldier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{soldier.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {soldier.confirmationTime || 'לא זמין'}
                      </div>
                    </TableCell>
                    <TableCell>{soldier.equipmentCount}</TableCell>
                    <TableCell>
                      {soldier.hasReport ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                          יש דיווח
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-800">
                          ללא בעיות
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );

      case 'pending':
        return (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם החייל</TableHead>
                  <TableHead className="text-right">כמות ציוד</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dialogData.map((soldier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{soldier.name}</TableCell>
                    <TableCell>{soldier.equipmentCount}</TableCell>
                    <TableCell className="text-sm text-slate-600" dir="ltr">{soldier.email || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-600" dir="ltr">{soldier.phone || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        );

      case 'reports':
        return (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {dialogData.map((report, index) => (
                <div key={index} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-slate-800">{report.soldier_name}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {safeFormatDate(report.confirmation_date)}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{report.report_details}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        );

      default:
        return <div>אין מידע זמין</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
