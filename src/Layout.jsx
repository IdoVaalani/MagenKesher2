import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { Soldier } from "@/entities/Soldier";
import { ClipboardList, Package, CheckSquare, BarChart3, Wrench, Menu, Users, Settings, Server, X } from "lucide-react";

const navigationItems = [
  { title: "לוח בקרה", url: createPageUrl("Dashboard"), icon: BarChart3, adminOnly: true },
  { title: "ניהול ציוד", url: createPageUrl("EquipmentManagement"), icon: Package, adminOnly: true },
  { title: "סוגי ציוד", url: createPageUrl("EquipmentTypes"), icon: Wrench, adminOnly: true },
  { title: "חיילים", url: createPageUrl("Soldiers"), icon: Users, adminOnly: true },
  { title: "דוחות", url: createPageUrl("Reports"), icon: ClipboardList, adminOnly: true },
  { title: "הגדרות", url: createPageUrl("Settings"), icon: Settings, adminOnly: true },
  { title: "לוג מערכת", url: createPageUrl("SystemLog"), icon: Server, adminOnly: true },
  { title: "אישור יומי", url: createPageUrl("DailyConfirmation"), icon: CheckSquare, adminOnly: false },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [soldiers, setSoldiers] = useState(null);

  const urlParams = new URLSearchParams(location.search);
  const hasToken = !!urlParams.get('token');

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (hasToken) {
      setIsLoading(false);
      return;
    }
    const loadInitialData = async () => {
      try {
        const [userData, soldiersList] = await Promise.all([
          User.me(),
          Soldier.list()
        ]);
        setUser(userData);
        setSoldiers(soldiersList);
      } catch (error) {
        User.login();
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [location.search, hasToken]);

  useEffect(() => {
    if (!hasToken && user && soldiers) {
      if (user.role === 'admin') return;
      const soldierRecord = soldiers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
      if (soldierRecord && soldierRecord.role === 'admin') return;
      const dailyConfirmationUrl = createPageUrl("DailyConfirmation");
      if (location.pathname !== dailyConfirmationUrl) {
        navigate(dailyConfirmationUrl, { replace: true });
      }
    }
  }, [user, soldiers, location.pathname, navigate, hasToken]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    if (user.role === 'admin') { setIsAdmin(true); return; }
    if (soldiers) {
      const soldierRecord = soldiers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
      setIsAdmin(soldierRecord && soldierRecord.role === 'admin');
    } else {
      setIsAdmin(false);
    }
  }, [user, soldiers]);

  if (hasToken) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <style>{`
          * { direction: rtl; }
          @media (max-width: 768px) {
            body { font-size: 16px; -webkit-text-size-adjust: 100%; }
            input, select, textarea, button { font-size: 16px !important; }
          }
        `}</style>
        {children}
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-6">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  const visibleItems = navigationItems.filter(item => !item.adminOnly || isAdmin);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center shadow-lg">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">פלוגה ב'</h2>
            <p className="text-xs text-slate-500">ניהול ציוד פלוגתי</p>
          </div>
        </div>
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 py-2">תפריט ראשי</p>
        {visibleItems.map(item => {
          const isActive = location.pathname.startsWith(item.url);
          return (
            <Link
              key={item.title}
              to={item.url}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{user.full_name?.charAt(0) || 'U'}</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 text-sm truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500">{isAdmin ? 'מנהל מערכת' : 'חייל'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-slate-50" dir="rtl">
      <style>{`* { direction: rtl; }`}</style>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-l border-slate-200 bg-white h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 md:hidden ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-lg font-bold text-slate-800">פלוגה ב'</h1>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}