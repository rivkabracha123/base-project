import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLanguageLoader } from './app/ProfileLanguageLoader';
import { AccountPage } from './app/AccountPage';
import { LotPage } from './app/LotPage';
import { SampleLotPage } from './app/SampleLotPage';
import { ChatPage } from './chat/ChatPage';
import { AppHeader } from './components/AppHeader';
import { ResultsPage } from './components/ResultPage';
import { StaffOperationsDashboard } from './staff-operations/StaffOperationsDashboard';
import { SellerEnquiryPage } from './app/SellerEnquiryPage';
import { SellerHouseChoicePage } from './app/SellerHouseChoicePage';
import { CurrentProfileGallery } from './app/CurrentProfileGallery';
import { BuyerHousesPage } from './buyer/BuyerHousesPage';

export function App() {
  return (
    <>
      <ProfileLanguageLoader />
      <AppHeader />
      <Routes>
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/buyer/houses" element={<BuyerHousesPage />} />
        <Route path="/lots/:id" element={<LotPage />} />
        <Route path="/chat/:role" element={<ChatPage />} />
        <Route path="/chat" element={<Navigate to="/chat/buyer" replace />} />
        {/* Personal area: review, update, and delete the current profile */}
        <Route path="/account" element={<AccountPage />} />
        {/* S5 Week 4: recommendation, alternatives, and seller-choice screen */}
        <Route path="/seller/houses" element={<SellerHouseChoicePage />} />
        {import.meta.env.DEV && (
        <Route path="/seller/gallery" element={<CurrentProfileGallery />} />
        )}
        {/* S5 Week 5: catalog draft review and final internal lead */}
        <Route path="/seller/enquiry" element={<SellerEnquiryPage />} />
        <Route path="*" element={<Navigate to="/results" replace />} />
      </Routes>
    </>
  );
}
