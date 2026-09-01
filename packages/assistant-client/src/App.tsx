import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';
import { SampleLotPage } from './app/SampleLotPage';

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        {/* הצגת לוח הבקרה התפעולי */}
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
