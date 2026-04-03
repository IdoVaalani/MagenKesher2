import React, { useState, useEffect } from 'react';
import { SystemLog } from '@/entities/SystemLog';
import { DailySummaryLog } from '@/entities/DailySummaryLog';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Search, RefreshCw } from "lucide-react";

export default function SystemLogAnalysis() {
  const [recentLogs, setRecentLogs] = useState([]);
  const [summaryLogs, setSummaryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState({
    hasTodaySummary: false,
    lastSummaryDate: null,
    automationErrors: [],
    emailErrors: [],
    communicationIssues: []
  });

  useEffect(() => {
    analyzeLogs();
  }, []);

  const analyzeLogs = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // טעינת לוגים של היומיים האחרונים
      const [logs, summaries] = await Promise.all([
        SystemLog.list('-created_date', 100),
        DailySummaryLog.list('-summary_date', 10)
      ]);

      setRecentLogs(logs || []);
      setSummaryLogs(summaries || []);

      // ניתוח
      const todaySummary = (summaries || []).find(s => s.summary_date === today);
      const lastSummary = summaries?.[0];
      
      const automationErrors = (logs || []).filter(log => 
        log.category === 'communication' && 
        log.level === 'error' &&
        log.message.includes('automation')
      );

      const emailErrors = (logs || []).filter(log => 
        log.category === 'email' && 
        log.level === 'error'
      );

      const communicationIssues = (logs || []).filter(log => 
        log.category === 'communication' && 
        (log.level === 'error' || log.level === 'warning') &&
        log.created_date.startsWith(today)
      );

      setAnalysis({
        hasTodaySummary: !!todaySummary,
        lastSummaryDate: lastSummary?.summary_date,
        automationErrors,
        emailErrors,
        communicationIssues
      });

    } catch (error) {
      console.error("שגיאה בניתוח הלוגים:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>מנתח לוגי מערכת...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ניתוח לוגי המערכת - סיכום אוטומטי</h1>
        <Button onClick={analyzeLogs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          רענן ניתוח
        </Button>
      </div>

      {/* סטטוס סיכום היומי */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {analysis.hasTodaySummary ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            סטטוס סיכום יומי
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.hasTodaySummary ? (
            <div className="text-green-700">
              ✅ סיכום יומי נשלח היום ({new Date().toLocaleDateString('he-IL')})
            </div>
          ) : (
            <div className="text-red-700">
              ❌ לא נשלח סיכום יומי היום
              {analysis.lastSummaryDate && (
                <p className="text-sm mt-2">
                  סיכום אחרון נשלח: {new Date(analysis.lastSummaryDate).toLocaleDateString('he-IL')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* בעיות תקשורת */}
      <Card>
        <CardHeader>
          <CardTitle>בעיות תקשורת היום</CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.communicationIssues.length === 0 ? (
            <p className="text-green-700">✅ לא נמצאו בעיות תקשורת</p>
          ) : (
            <div className="space-y-2">
              {analysis.communicationIssues.map((log, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center gap-2">
                    <Badge className={log.level === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                      {log.level}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {new Date(log.created_date).toLocaleTimeString('he-IL')}
                    </span>
                  </div>
                  <p className="mt-1">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* שגיאות מייל */}
      <Card>
        <CardHeader>
          <CardTitle>שגיאות מייל</CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.emailErrors.length === 0 ? (
            <p className="text-green-700">✅ לא נמצאו שגיאות מייל</p>
          ) : (
            <div className="space-y-2">
              {analysis.emailErrors.slice(0, 5).map((log, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-800">שגיאת מייל</Badge>
                    <span className="text-sm text-gray-600">
                      {new Date(log.created_date).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <p className="mt-1">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* היסטוריית סיכומים */}
      <Card>
        <CardHeader>
          <CardTitle>היסטוריית סיכומים יומיים</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLogs.length === 0 ? (
            <p>לא נמצאו רשומות של סיכומים קודמים</p>
          ) : (
            <div className="space-y-2">
              {summaryLogs.slice(0, 10).map((summary, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">
                      {new Date(summary.summary_date).toLocaleDateString('he-IL')}
                    </span>
                    <span className="text-sm text-gray-600 mr-2">
                      נשלח: {new Date(summary.sent_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {summary.success_count > 0 && (
                      <Badge className="bg-green-100 text-green-800">
                        הצליח: {summary.success_count}
                      </Badge>
                    )}
                    {summary.failed_count > 0 && (
                      <Badge className="bg-red-100 text-red-800">
                        נכשל: {summary.failed_count}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* לוגים אחרונים */}
      <Card>
        <CardHeader>
          <CardTitle>לוגים אחרונים (50 אחרונים)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {recentLogs.slice(0, 50).map((log, index) => (
              <div key={index} className="text-sm p-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Badge className={
                    log.level === 'error' ? 'bg-red-100 text-red-800' :
                    log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }>
                    {log.level}
                  </Badge>
                  <Badge variant="outline">{log.category}</Badge>
                  <span className="text-gray-500 text-xs">
                    {new Date(log.created_date).toLocaleString('he-IL')}
                  </span>
                </div>
                <p className="mt-1 text-gray-700">{log.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}