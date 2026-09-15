import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { SampleLotPage } from './app/SampleLotPage';
import { SellerEnquiryPage } from './app/SellerEnquiryPage';
import { SellerHouseChoicePage } from './app/SellerHouseChoicePage';

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/sample" element={<SampleLotPage />} />
        {/* S5 Week 4: recommendation, alternatives, and seller-choice screen */}
        <Route path="/seller/houses" element={<SellerHouseChoicePage />} />
        {/* S5 Week 5: catalog draft review and final internal lead */}
        <Route path="/seller/enquiry" element={<SellerEnquiryPage />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
