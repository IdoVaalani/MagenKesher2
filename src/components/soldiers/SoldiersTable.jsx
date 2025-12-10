
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SoldiersTable({ soldiers, loading, onEdit, onDelete }) {
  const getCommunicationMethodDisplay = (method) => {
    switch (method) {
      case 'email':
        return { text: 'מייל מובנית', color: 'bg-blue-100 text-blue-800' };
      case 'gmail':
        return { text: 'מייל גוגל', color: 'bg-red-100 text-red-800' };
      case 'sms':
        return { text: 'SMS', color: 'bg-green-100 text-green-800' };
      case 'default':
      default:
        return { text: 'הגדרות מערכת', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">טוען חיילים...</p>
      </div>
    );
  }

  // הוספת הגנה חזקה יותר - ensures soldiers is always an array
  const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];

  if (safeSoldiers.length === 0) {
    return (
      <div className="p-8 text-center">
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-600 mb-2">אין חיילים במערכת</p>
        <p className="text-slate-500 text-sm">הוסף חיילים כדי להתחיל</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            <TableHead className="text-right">שם מלא</TableHead>
            <TableHead className="text-right">מספר אישי</TableHead>
            <TableHead className="text-right">אימייל</TableHead>
            <TableHead className="text-right">טלפון</TableHead>
            <TableHead className="text-right">תפקיד</TableHead>
            <TableHead className="text-right">העדפת תקשורת</TableHead>
            <TableHead className="text-right">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeSoldiers.map((soldier) => (
            <TableRow key={soldier.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{soldier.full_name}</TableCell>
              <TableCell className="text-slate-600">{soldier.personal_id || '-'}</TableCell>
              <TableCell className="text-slate-600" dir="ltr">{soldier.email || '-'}</TableCell>
              <TableCell className="text-slate-600" dir="ltr">{soldier.phone_number || '-'}</TableCell>
              <TableCell>
                <Badge className={soldier.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                  {soldier.role === 'admin' ? 'מנהל' : 'חייל'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={getCommunicationMethodDisplay(soldier.preferred_communication_method).color}>
                  {getCommunicationMethodDisplay(soldier.preferred_communication_method).text}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(soldier)}
                    className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(soldier.id)}
                    className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
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
