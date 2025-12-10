
import React, { useState, useEffect, useRef } from 'react';
import { handleEquipmentSignature } from '@/functions/handleEquipmentSignature';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle, Signature, RotateCcw } from 'lucide-react';

export default function SignEquipment() {
  const [token, setToken] = useState('');
  const [soldierName, setSoldierName] = useState('');
  const [equipmentDetails, setEquipmentDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (!urlToken) {
      setError("לא נמצא טוקן בקישור. אנא ודא שהקישור שהעתקת מלא.");
      setLoading(false);
      return;
    }

    setToken(urlToken);
    validateTokenDirectly(urlToken);
  }, []);

  const validateTokenDirectly = async (tokenToValidate) => {
    setLoading(true);
    try {
      const { data, error: funcError } = await handleEquipmentSignature({
        token: tokenToValidate,
        action: 'validate_only'
      });

      if (funcError || !data?.success) {
        throw new Error(funcError?.message || data?.error || 'שגיאה באימות הקישור');
      }

      setEquipmentDetails(data.equipment_details || []);
      setSoldierName(data.soldier_name || 'חייל');
      
    } catch (e) {
      console.error("Token validation error:", e);
      setError("שגיאה בטעינת נתוני הציוד: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing functions
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setIsSigned(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoordinates(e);
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2563eb';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsSigned(false);
  };

  const handleSubmitSignature = async () => {
    if (!isSigned) {
      alert("יש לחתום על המסך לפני האישור.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const canvas = canvasRef.current;
      const signatureDataUrl = canvas.toDataURL('image/png');

      const { data, error: funcError } = await handleEquipmentSignature({
        token: token,
        signatureData: signatureDataUrl,
        action: 'submit_signature'
      });

      if (funcError || !data?.success) {
        throw new Error(funcError?.message || data?.error || 'שגיאה בשמירת החתימה');
      }

      clearSignature();
      setError(null);
      setSignatureComplete(true);
      alert("החתימה נשמרה בהצלחה!");

    } catch (e) {
      console.error("Signature submission error:", e);
      setError(`שגיאה בשמירת החתימה: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ direction: 'rtl' }} className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <style>{`
          * { direction: rtl; }
          @media (max-width: 768px) {
            body { font-size: 16px; -webkit-text-size-adjust: 100%; }
            input, select, textarea, button { font-size: 16px !important; }
          }
        `}</style>
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">טוען נתוני חתימה...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ direction: 'rtl' }} className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <style>{`
          * { direction: rtl; }
          @media (max-width: 768px) {
            body { font-size: 16px; -webkit-text-size-adjust: 100%; }
            input, select, textarea, button { font-size: 16px !important; }
          }
        `}</style>
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signatureComplete) {
    return (
      <div style={{ direction: 'rtl' }} className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <style>{`
          * { direction: rtl; }
          @media (max-width: 768px) {
            body { font-size: 16px; -webkit-text-size-adjust: 100%; }
            input, select, textarea, button { font-size: 16px !important; }
          }
        `}</style>
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">החתימה נשמרה בהצלחה!</h2>
            <p className="text-slate-600">תודה על החתימה. המידע נשמר במערכת.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl' }} className="min-h-screen bg-slate-50 p-4">
      <style>{`
        * { direction: rtl; }
        @media (max-width: 768px) {
          body { font-size: 16px; -webkit-text-size-adjust: 100%; }
          input, select, textarea, button { font-size: 16px !important; }
        }
      `}</style>
      
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Signature className="w-6 h-6 text-blue-600" />
              חתימה דיגיטלית על ציוד
            </CardTitle>
            <CardDescription>
              שלום {soldierName}, אנא חתום על הציוד שקיבלת
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">ציוד לחתימה:</h3>
              {equipmentDetails.length > 0 ? (
                <ul className="list-disc list-inside text-blue-800">
                  {equipmentDetails.map((item, index) => (
                    <li key={item.id || index}>
                      {item.name} {item.serial_number && `(מ"ס: ${item.serial_number})`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-blue-800">אין ציוד ספציפי המקושר לחתימה זו.</p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">חתום כאן:</h3>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-2">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={200}
                  className="w-full border border-slate-200 rounded cursor-crosshair bg-white"
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <p className="text-sm text-slate-500">
                השתמש באצבע או בעכבר כדי לחתום במסגרת למעלה
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={clearSignature}
              disabled={!isSigned || isSubmitting}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              נקה חתימה
            </Button>
            <Button
              onClick={handleSubmitSignature}
              disabled={!isSigned || isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 ml-2" />
                  אשר חתימה
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
