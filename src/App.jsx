import './App.css'
import React, { useEffect, useState } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const [redirectFailed, setRedirectFailed] = useState(false);

  // Check if current URL has a token parameter (for token-based access like DailyConfirmation)
  const urlParams = new URLSearchParams(window.location.search);
  const hasToken = !!urlParams.get('token');
  const isTokenBasedPage = (window.location.pathname.includes('DailyConfirmation') || window.location.pathname.includes('SignEquipment')) && hasToken;

  const needsLogin = authError?.type === 'auth_required' && !isTokenBasedPage;

  // Handle redirect to login via useEffect (not during render)
  useEffect(() => {
    if (needsLogin) {
      navigateToLogin();
      // If redirect doesn't happen within 3 seconds, show manual button
      const timer = setTimeout(() => setRedirectFailed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [needsLogin]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    if (!isTokenBasedPage) {
      return (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      );
    }
  }

  // Handle authentication errors
  if (authError && !isTokenBasedPage) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50" dir="rtl">
          <div className="text-center p-6">
            {!redirectFailed ? (
              <>
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">מעביר לדף התחברות...</p>
              </>
            ) : (
              <>
                <p className="text-slate-700 text-lg mb-4">נדרשת התחברות</p>
                <button
                  onClick={() => navigateToLogin()}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  התחבר</button>
              </>
            )}
          </div>
        </div>
      );
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App