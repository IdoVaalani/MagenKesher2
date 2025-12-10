
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Check } from "lucide-react";


export default function EquipmentReports({ reports, loading, onResolve }) {
  return (
    <Card className="shadow-xl border-2 border-yellow-400 bg-yellow-50/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-yellow-800">
          <AlertTriangle className="w-6 h-6" />
          התראות על דיווחי ציוד
        </CardTitle>
        <CardDescription className="text-yellow-700">
          דיווחים אחרונים מחיילים על ציוד חסר או תקול. יש לטפל בהם בהקדם.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4 p-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-4 text-green-700">
            <CheckCircle className="w-10 h-10 mx-auto mb-2" />
            <p className="font-semibold">אין דיווחים חדשים</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
            {reports.map(report => (
              <div key={report.id} className="flex items-center justify-between p-4 border border-yellow-200 bg-white rounded-lg">
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-slate-800">{report.soldier_name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(report.confirmation_date).toLocaleDateString('he-IL', { timeZone: 'UTC' })}
                    </p>
                  </div>
                  <p className="text-slate-700">{report.report_details}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-green-600 hover:bg-green-100 rounded-full ml-4"
                  onClick={() => onResolve(report)}
                  title="סמן כטופל"
                >
                  <Check className="w-5 h-5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
