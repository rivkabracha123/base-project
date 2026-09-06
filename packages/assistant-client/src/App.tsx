import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { LotPage } from './app/LotPage';
import { SampleLotPage } from './app/SampleLotPage';
import { ResultsPage } from './components/ResultPage';
import { BuyerChat } from './buyer/BuyerChat';

export function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/sample" element={<SampleLotPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/lots/:id" element={<LotPage />} />
        <Route path="*" element={<Navigate to="/results" replace />} />
        <Route path="/chat" element={<BuyerChat />} />
        <Route path="*" element={<Navigate to="/sample" replace />} />
      </Routes>
    </>
  );
}
