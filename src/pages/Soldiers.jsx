import React, { useState, useEffect } from "react";
import { useCompany } from "@/components/CompanyContext";
import { Soldier } from "@/entities/Soldier";
import { Equipment } from "@/entities/Equipment";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SoldiersTable from "../components/soldiers/SoldiersTable";
import SoldierFormDialog from "../components/soldiers/SoldierFormDialog";
import ConfirmationDialog from "../components/soldiers/ConfirmationDialog";

// Helper function for retrying operations
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};

export default function SoldiersPage() {
  const { currentCompany } = useCompany();
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [soldierToDelete, setSoldierToDelete] = useState(null);

  useEffect(() => {
    if (currentCompany) {
      loadSoldiers();
    }
  }, [currentCompany]);

  const loadSoldiers = async () => {
    if (!currentCompany) return;
    
    setLoading(true);
    try {
      const data = await retryOperation(() => Soldier.filter({ company_id: currentCompany.id }, "-created_date"));
      setSoldiers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading soldiers after retries:", error);
      setSoldiers([]);
      alert("שגיאה בטעינת רשימת החיילים. אנא נסה לרענן את הדף.");
    }
    setLoading(false);
  };

  const handleSaveSoldier = async (soldierData) => {
    try {
      if (editingSoldier) {
        await retryOperation(() => Soldier.update(editingSoldier.id, soldierData));
      } else {
        await retryOperation(() => Soldier.create(soldierData));
      }
      setShowDialog(false);
      setEditingSoldier(null);
      await loadSoldiers();
    } catch (error) {
      console.error("Error saving soldier:", error);
      alert("שגיאה בשמירת החייל. אנא נסה שנית.");
    }
  };

  const handleDeleteRequest = (id) => {
    const soldier = soldiers.find(s => s.id === id);
    if (soldier) {
      setSoldierToDelete(soldier);
      setIsConfirmDialogOpen(true);
    }
  };

  const executeDeleteSoldier = async () => {
    if (!soldierToDelete) return;

    try {
      console.log(`Starting deletion process for soldier: ${soldierToDelete.full_name}`);
      
      // Find and delete equipment assignments with retry
      let deletedAssignmentsCount = 0;
      
      try {
        const assignmentsToDelete = [];
        
        if (soldierToDelete.personal_id) {
          const byId = await retryOperation(() => Equipment.filter({ company_id: currentCompany.id, soldier_id: soldierToDelete.personal_id }));
          if (byId && Array.isArray(byId)) assignmentsToDelete.push(...byId);
        }
        
        const byName = await retryOperation(() => Equipment.filter({ company_id: currentCompany.id, soldier_name: soldierToDelete.full_name }));
        if (byName && Array.isArray(byName)) assignmentsToDelete.push(...byName);

        const uniqueAssignments = Array.from(new Map(assignmentsToDelete.map(item => [item.id, item])).values());
        
        console.log(`Found ${uniqueAssignments.length} equipment assignments to delete`);

        if (uniqueAssignments.length > 0) {
          // Delete assignments one by one to avoid overwhelming the server
          for (const assignment of uniqueAssignments) {
            try {
              await retryOperation(() => Equipment.delete(assignment.id));
              deletedAssignmentsCount++;
            } catch (error) {
              console.error(`Failed to delete assignment ${assignment.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Error handling equipment assignments:", error);
        // Continue with soldier deletion even if equipment deletion fails
      }

      // Delete the soldier with retry
      await retryOperation(() => Soldier.delete(soldierToDelete.id));
      console.log(`Soldier ${soldierToDelete.full_name} deleted successfully`);
      
      alert(`החייל ${soldierToDelete.full_name} נמחק בהצלחה.\nנמחקו ${deletedAssignmentsCount} שיוכי ציוד.`);
      
      // Reload soldiers list
      await loadSoldiers();
      
    } catch (error) {
      console.error("Error deleting soldier:", error);
      alert(`שגיאה במחיקת החייל: ${error.message}`);
    } finally {
      setSoldierToDelete(null);
      setIsConfirmDialogOpen(false);
    }
  };

  const handleEdit = (soldier) => {
    setEditingSoldier(soldier);
    setShowDialog(true);
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">ניהול חיילים</h1>
            <p className="text-slate-600">הוספה, עריכה ומחיקה של חיילים במערכת</p>
          </div>
          <Button 
            onClick={() => { setEditingSoldier(null); setShowDialog(true); }}
            className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            הוסף חייל חדש
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <CardTitle className="text-xl font-bold text-slate-800">
              רשימת חיילים ({Array.isArray(soldiers) ? soldiers.length : 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SoldiersTable
              soldiers={soldiers}
              loading={loading}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
            />
          </CardContent>
        </Card>

        <SoldierFormDialog
          open={showDialog}
          onOpenChange={(isOpen) => {
             if (!isOpen) setEditingSoldier(null);
             setShowDialog(isOpen);
          }}
          onSave={handleSaveSoldier}
          editingSoldier={editingSoldier}
        />
        
        <ConfirmationDialog
          open={isConfirmDialogOpen}
          onOpenChange={setIsConfirmDialogOpen}
          title="אישור מחיקת חייל"
          description={`האם אתה בטוח שברצונך למחוק את החייל ${soldierToDelete?.full_name}? פעולה זו תמחק גם את כל שיוכי הציוד שלו ולא ניתנת לשחזור.`}
          onConfirm={executeDeleteSoldier}
        />
      </div>
    </div>
  );
}