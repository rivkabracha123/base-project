import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLanguageLoader } from './app/ProfileLanguageLoader';
import { AppHeader } from './components/AppHeader';
import { SampleLotPage } from './app/SampleLotPage';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';
export function App() {
  return (
    <>
      <ProfileLanguageLoader />
      <AppHeader />
      <Routes>

        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="/staff-operations" element={<StaffOperationsDashboard />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
