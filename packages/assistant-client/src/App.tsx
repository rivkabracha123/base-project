import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLanguageLoader } from './app/ProfileLanguageLoader';
import { AppHeader } from './components/AppHeader';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';
import { SampleLotPage } from './app/SampleLotPage';
// Avishag's task API page
import { SellerHouseChoicePage } from './app/SellerHouseChoicePage';

export function App() {
  return (
    <>
      <ProfileLanguageLoader />
      <AppHeader />
      <Routes>
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="/sample" element={<SampleLotPage />} />
        {/* S5 Week 4: recommendation, alternatives, and seller-choice screen */}
        <Route path="/seller/houses" element={<SellerHouseChoicePage />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
