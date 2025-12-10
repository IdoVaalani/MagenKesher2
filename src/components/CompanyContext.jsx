import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const CompanyContext = createContext();

export function CompanyProvider({ children }) {
  const [currentCompany, setCurrentCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const user = await base44.auth.me();
      const allCompanies = await base44.entities.Company.list();
      
      setCompanies(allCompanies);
      
      // טען פלוגה שמורה מ-localStorage או קח את הראשונה
      const savedCompanyId = localStorage.getItem('selected_company_id');
      if (savedCompanyId && allCompanies.find(c => c.id === savedCompanyId)) {
        setCurrentCompany(allCompanies.find(c => c.id === savedCompanyId));
      } else if (allCompanies.length > 0) {
        setCurrentCompany(allCompanies[0]);
        localStorage.setItem('selected_company_id', allCompanies[0].id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
    setLoading(false);
  };

  const switchCompany = (company) => {
    setCurrentCompany(company);
    localStorage.setItem('selected_company_id', company.id);
  };

  return (
    <CompanyContext.Provider value={{ currentCompany, companies, loading, switchCompany, loadCompanies }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}