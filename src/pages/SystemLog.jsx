import React, { useState, useEffect } from 'react';
import { SystemLog } from '@/entities/SystemLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ServerCrash, Info, AlertTriangle } from 'lucide-react';

export default function SystemLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const logData = await SystemLog.list('-created_date', 200); // Fetch latest 200 logs
        setLogs(logData || []);
      } catch (error) {
        console.error("Error fetching system logs:", error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getLevelAppearance = (level) => {
    switch (level) {
      case 'error':
        return { icon: <ServerCrash className="w-4 h-4" />, color: 'bg-red-100 text-red-800 border-red-300' };
      case 'warning':
        return { icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      case 'info':
      default:
        return { icon: <Info className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <header className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-1">לוג מערכת</h1>
          <p className="text-slate-600 text-xs sm:text-sm">סקירת פעולות והתראות שהתרחשו במערכת.</p>
        </header>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>יומן אירועים</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="mr-3">טוען לוגים...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500">לא נמצאו רשומות לוג.</p>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="block md:hidden space-y-3 max-h-[70vh] overflow-y-auto">
                  {logs.map((log) => {
                    const { icon, color } = getLevelAppearance(log.level);
                    return (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`capitalize ${color} flex items-center gap-1`}>
                            {icon}
                            {log.level}
                          </Badge>
                          <Badge variant="secondary" className="capitalize text-xs">{log.category}</Badge>
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed">{log.message}</p>
                        <p className="text-xs text-slate-400 font-mono">
                          {new Date(log.created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block border rounded-lg overflow-auto max-h-[70vh]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[200px] text-right">זמן</TableHead>
                        <TableHead className="w-[120px] text-right">רמה</TableHead>
                        <TableHead className="w-[150px] text-right">קטגוריה</TableHead>
                        <TableHead className="text-right">הודעה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const { icon, color } = getLevelAppearance(log.level);
                        return (
                          <TableRow key={log.id} className="hover:bg-slate-50/50">
                            <TableCell className="text-sm text-slate-600 font-mono">
                              {new Date(log.created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`capitalize ${color} flex items-center gap-1`}>
                                {icon}
                                {log.level}
                              </Badge>
                            </TableCell>
                             <TableCell>
                              <Badge variant="secondary" className="capitalize">{log.category}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-800">{log.message}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}