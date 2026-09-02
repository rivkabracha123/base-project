import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLanguageLoader } from './app/ProfileLanguageLoader';
import { AppHeader } from './components/AppHeader';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';
import { SampleLotPage } from './app/SampleLotPage';
// Avishag's task API page

export function App() {
  return (
    <>
      <ProfileLanguageLoader />
      <AppHeader />
      <Routes>
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
