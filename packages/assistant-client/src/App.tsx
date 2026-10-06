import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { SampleLotPage } from './app/SampleLotPage';
import { SellerHouseChoicePage } from './app/SellerHouseChoicePage';
import { EvidenceGallery } from './app/evidenceGallery'

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/sample" element={<SampleLotPage />} />
        {/* S5 Week 4: recommendation, alternatives, and seller-choice screen */}
        <Route path="/seller/houses" element={<SellerHouseChoicePage />} />
        {import.meta.env.DEV && (
        <Route
            path="/seller/gallery"
            element={<EvidenceGallery profileId="demo-profile-gallery" />}
        />
        )}
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
