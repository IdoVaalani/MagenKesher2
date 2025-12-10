
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Wrench, CheckCircle, XCircle } from "lucide-react";

export default function EquipmentTypesTable({ equipmentTypes, loading, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="flex space-x-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!Array.isArray(equipmentTypes) || equipmentTypes.length === 0) {
    return (
      <div className="p-8 text-center">
        <Wrench className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">אין סוגי ציוד במערכת</h3>
        <p className="text-slate-500">התחל בהוספת סוג הציוד הראשון</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            <TableHead className="text-right font-semibold">מספר צ'</TableHead>
            <TableHead className="text-right font-semibold">שם הציוד</TableHead>
            <TableHead className="text-right font-semibold">סוג שיוך</TableHead>
            <TableHead className="text-right font-semibold">תיאור</TableHead>
            <TableHead className="text-right font-semibold">דגם</TableHead>
            <TableHead className="text-right font-semibold">סטטוס</TableHead>
            <TableHead className="text-right font-semibold">תאריך יצירה</TableHead>
            <TableHead className="text-right font-semibold">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipmentTypes.map((item) => (
            <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
              <TableCell className="font-mono font-semibold text-slate-800">
                {item.serial_number && item.serial_number > 0 ? item.serial_number : '-'}
              </TableCell>
              <TableCell className="font-semibold text-slate-800">
                {item.name}
              </TableCell>
              <TableCell>
                {item.serial_number && item.serial_number > 0 ? (
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                    ייחודי
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    נלווה
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {item.description || '-'}
              </TableCell>
              <TableCell>{item.model || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {item.is_active ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 text-sm font-medium">פעיל</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 text-sm">לא פעיל</span>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {new Date(item.created_date).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                    className="h-8 w-8 p-0 hover:bg-red-100"
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
}
