import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Save, X } from "lucide-react";

export default function DigitalSignatureDialog({ open, onOpenChange, soldier, equipmentTypes, onSignatureComplete, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getContext = () => {
      const canvas = canvasRef.current;
      return canvas ? canvas.getContext("2d") : null;
  }

  // Setup canvas context properties
  useEffect(() => {
    const context = getContext();
    if(context) {
        context.lineCap = "round";
        context.strokeStyle = "black";
        context.lineWidth = 2;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => { // Use timeout to ensure canvas is rendered before clearing
        clear();
      }, 100);
    }
  }, [open]);

  const startDrawing = (event) => {
    event.preventDefault();
    const context = getContext();
    if(!context) return;
    const { offsetX, offsetY } = getCoords(event);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const context = getContext();
    if(!context) return;
    const { offsetX, offsetY } = getCoords(event);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    const context = getContext();
    if(!context) return;
    context.closePath();
    setIsDrawing(false);
  };
    
  const getCoords = (event) => {
      const canvas = canvasRef.current;
      if(!canvas) return { offsetX:0, offsetY:0 };
      const rect = canvas.getBoundingClientRect();
      
      let clientX, clientY;
      if (event.touches && event.touches.length > 0) {
          clientX = event.touches[0].clientX;
          clientY = event.touches[0].clientY;
      } else {
          clientX = event.clientX;
          clientY = event.clientY;
      }
      return {
          offsetX: clientX - rect.left,
          offsetY: clientY - rect.top
      };
  }

  const clear = () => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
    }
  };

  const handleSave = () => {
    if (isEmpty) {
      alert("יש לחתום לפני השמירה.");
      return;
    }
    const signatureData = canvasRef.current.toDataURL("image/png");
    onSignatureComplete(signatureData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>חתימה דיגיטלית</DialogTitle>
          <DialogDescription>
            אנא אשר קבלת הציוד הבא עבור <strong>{soldier?.full_name}</strong> באמצעות חתימה דיגיטלית.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 p-3 bg-slate-50 border rounded-md max-h-40 overflow-y-auto">
          <p className="font-semibold mb-2">פריטים לחתימה:</p>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {(equipmentTypes || []).map(eq => (
              <li key={eq.id}>
                {eq.name}
                {eq.serial_number ? <span className="font-mono text-blue-600"> (צ': {eq.serial_number})</span> : ''}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="border border-slate-300 rounded-lg overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            width={450}
            height={192}
            className="w-full h-48 bg-white"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1 text-center">חתום באמצעות העכבר או האצבע</p>

        <DialogFooter className="pt-4 border-t gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 ml-2" /> ביטול
          </Button>
          <Button type="button" variant="ghost" onClick={clear}>
            <RefreshCw className="w-4 h-4 ml-2" /> נקה
          </Button>
          <Button onClick={handleSave} disabled={isEmpty} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 ml-2" /> שמור חתימה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}