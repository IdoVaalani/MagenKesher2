import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Package, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AddToSoldierDialog from './AddToSoldierDialog';

export default function SoldierEquipmentDetailsDialog({ 
  open, 
  onOpenChange, 
  soldier, 
  allEquipmentTypes, 
  allAssignments, 
  onRefreshData 
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);

  const typesMap = useMemo(() => {
    return new Map((allEquipmentTypes || []).map(type => [type.id, type]));
  }, [allEquipmentTypes]);

  const handleRemoveItem = async (assignmentId) => {
    console.log("🔴 handleRemoveItem called with ID:", assignmentId);
    
    try {
      const assignmentToRemove = allAssignments.find(a => a.id === assignmentId);
      console.log("📦 Assignment to remove:", assignmentToRemove);
      
      if (!assignmentToRemove) {
        alert("שגיאה: השיוך לא נמצא.");
        return;
      }

      const type = typesMap.get(assignmentToRemove.equipment_type_id);
      const equipmentName = type?.name || 'ציוד זה';
      
      const confirmDelete = window.confirm(`האם אתה בטוח שברצונך למחוק את ${equipmentName} מהחייל?\n\nפעולה זו תבטל גם את החתימה המקושרת, אם קיימת.`);
      console.log("✅ User confirmed deletion:", confirmDelete);
      
      if (!confirmDelete) {
        return;
      }

      setDeletingItemId(assignmentId);
      console.log("🔄 Starting deletion process...");

      // ביטול חתימות קשורות
      try {
        console.log("🔍 Looking for signatures to revoke...");
        const allSignatures = await base44.entities.EquipmentSignature.list();
        const signaturesToRevoke = allSignatures.filter(sig => 
          sig.status === 'active' &&
          sig.soldier_name === assignmentToRemove.soldier_name &&
          sig.equipment_items?.some(item => item.equipment_type_id === assignmentToRemove.equipment_type_id)
        );

        console.log("📝 Found signatures to revoke:", signaturesToRevoke.length);

        for (const sig of signaturesToRevoke) {
          await base44.entities.EquipmentSignature.update(sig.id, { status: 'revoked' });
          console.log("✏️ Revoked signature:", sig.id);
        }
      } catch (sigError) {
        console.error("❌ Error revoking signatures:", sigError);
      }

      // מחיקת השיוך
      console.log("🗑️ Deleting equipment assignment...");
      await base44.entities.Equipment.delete(assignmentId);
      console.log("✅ Equipment deleted successfully!");
      
      alert("הפריט נמחק בהצלחה!");
      onRefreshData();
      
    } catch (error) {
      console.error("❌ Error deleting equipment item:", error);
      alert(`שגיאה במחיקת הפריט: ${error.message || 'שגיאה לא ידועה'}`);
    } finally {
      setDeletingItemId(null);
      console.log("🏁 Deletion process completed");
    }
  };

  const handleAddSuccess = () => {
    setShowAddDialog(false);
    onRefreshData();
  };

  const assignmentsForSoldier = soldier ? allAssignments.filter(a => a.soldier_name === soldier.full_name) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>ניהול ציוד עבור: {soldier?.full_name}</DialogTitle>
            <DialogDescription>
              כאן ניתן לראות, להוסיף או להסיר פריטי ציוד עבור חייל זה.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {assignmentsForSoldier.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600">אין ציוד משויך לחייל זה.</h3>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                    <TableRow>
                      <TableHead className="text-right">שם הציוד</TableHead>
                      <TableHead className="text-right">מספר צ'</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignmentsForSoldier.map(item => {
                      const type = typesMap.get(item.equipment_type_id);
                      const isDeleting = deletingItemId === item.id;
                      const itemId = item.id; // שומרים את ה-ID במשתנה נפרד
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{type?.name || 'לא ידוע'}</TableCell>
                          <TableCell>{type?.serial_number || '-'}</TableCell>
                          <TableCell><Badge variant="outline" className={item.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : item.status === 'maintenance' ? 'bg-amber-50 text-amber-700 border-amber-200' : item.status === 'lost' ? 'bg-red-50 text-red-700 border-red-200' : item.status === 'damaged' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-700 border-slate-200'}>{item.status === 'active' ? 'תקין' : item.status === 'maintenance' ? 'בתחזוקה' : item.status === 'lost' ? 'אבד' : item.status === 'damaged' ? 'פגום' : 'תקין'}</Badge></TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => {
                                console.log("🖱️ Delete button clicked for item:", itemId);
                                handleRemoveItem(itemId);
                              }}
                              disabled={isDeleting}
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-red-50 h-9 w-9"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-500" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <DialogFooter className="sm:justify-between items-center gap-4 border-t pt-4">
              <div className="flex-1">
                 <p className="text-sm text-slate-500">סה"כ פריטים: {assignmentsForSoldier.length}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                    <X className="w-4 h-4 mr-2" />
                    סגור
                </Button>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  הוסף ציוד
                </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {soldier && (
        <AddToSoldierDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          soldierName={soldier.full_name}
          soldierId={soldier.personal_id}
          soldierEmail={soldier.email}
          equipmentTypes={allEquipmentTypes}
          assignments={allAssignments}
          onAssignSuccess={handleAddSuccess}
        />
      )}
    </>
  );
}