import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLanguageLoader } from './app/ProfileLanguageLoader';
import { LotPage } from './app/LotPage';
import { SampleLotPage } from './app/SampleLotPage';
import { BuyerChat } from './buyer/BuyerChat';
import { AppHeader } from './components/AppHeader';
import { ResultsPage } from './components/ResultPage';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';

export function App() {
  return (
    <>
      <ProfileLanguageLoader />
      <AppHeader />
      <Routes>
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/lots/:id" element={<LotPage />} />
        <Route path="/chat" element={<BuyerChat />} />
        <Route path="*" element={<Navigate to="/results" replace />} />
      </Routes>
    </>
  );
}
