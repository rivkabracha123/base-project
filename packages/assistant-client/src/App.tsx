import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLanguageLoader } from './app/ProfileLanguageLoader';
import { LotPage } from './app/LotPage';
import { SampleLotPage } from './app/SampleLotPage';
import { AssistantPage } from './app/AssistantPage';
import { BuyerChat } from './buyer/BuyerChat';
import { AppHeader } from './components/AppHeader';
import { ResultsPage } from './components/ResultPage';
import { StaffOperationsDashboard } from './staff-operations/StaffOperationsDashboard';
import { SellerEnquiryPage } from './app/SellerEnquiryPage';
import { SellerHouseChoicePage } from './app/SellerHouseChoicePage';

export function App() {
  return (
    <>
      <ProfileLanguageLoader />
      <AppHeader />
      <Routes>
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/lots/:id" element={<LotPage />} />
        <Route path="/chat" element={<BuyerChat />} />
        {/* S5 Week 4: recommendation, alternatives, and seller-choice screen */}
        <Route path="/seller/houses" element={<SellerHouseChoicePage />} />
        {/* S5 Week 5: catalog draft review and final internal lead */}
        <Route path="/seller/enquiry" element={<SellerEnquiryPage />} />
        <Route path="*" element={<Navigate to="/results" replace />} />
      </Routes>
    </>
  );
}
