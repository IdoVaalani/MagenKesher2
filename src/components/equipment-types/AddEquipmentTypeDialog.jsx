import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, X } from "lucide-react";

export default function AddEquipmentTypeDialog({ open, onOpenChange, onSave, editingType }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    model: "",
    serial_number: "",
    is_active: true
  });

  useEffect(() => {
    if (editingType) {
      setFormData({
        name: editingType.name || "",
        description: editingType.description || "",
        model: editingType.model || "",
        serial_number: editingType.serial_number?.toString() || "",
        is_active: editingType.is_active !== false,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        model: "",
        serial_number: "",
        is_active: true
      });
    }
  }, [editingType, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      serial_number: parseInt(formData.serial_number) || 0
    };
    onSave(dataToSave);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            {editingType ? "עריכת סוג ציוד" : "הוספת סוג ציוד חדש"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 border rounded-lg bg-blue-50">
            <h3 className="font-semibold text-blue-800 mb-2">הבחנה בסוגי ציוד</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>ציוד עם מספר צ':</strong> ניתן לשיוך פעם אחת בלבד לחייל אחד</p>
              <p><strong>ציוד נלווה (ללא צ'):</strong> ניתן לשיוך למספר חיילים</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serial_number">מספר צ' (אם קיים)</Label>
              <Input
                id="serial_number"
                type="number"
                value={formData.serial_number}
                onChange={(e) => handleInputChange('serial_number', e.target.value)}
                placeholder="השאר ריק עבור ציוד נלווה"
                className="font-mono"
              />
              <p className="text-xs text-slate-500">
                {formData.serial_number && parseInt(formData.serial_number) > 0
                  ? "ציוד ייחודי - ניתן לשיוך פעם אחת בלבד"
                  : "ציוד נלווה - ניתן לשיוך למספר חיילים"
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">שם הציוד*</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="שם הציוד"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="model">דגם</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                placeholder="דגם הציוד"
              />
            </div>
            
            <div className="space-y-2 flex items-center gap-3 pt-4">
               <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active" className="font-medium">
                סוג ציוד פעיל
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="תיאור הציוד..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4 mr-2" />
              ביטול
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingType ? "עדכן" : "שמור"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}