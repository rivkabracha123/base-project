import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { BuyerChat } from '../buyer/BuyerChat';
import { restoreBuyerChatFlowState } from '../buyer/buyer-chat-flow';
import { SellerChat } from '../seller/SellerChat';

// Routes a chat visitor to the right conversation screen by role. Both screens render the same
// ChatScreen shell (see chat/ChatScreen.tsx) — only the data source, message schema, and message
// rendering differ per role. An unrecognised or missing role falls back to the buyer chat.
export function ChatPage() {
  const { role } = useParams<{ role: string }>();
  const location = useLocation();
  const selectedLotId = new URLSearchParams(location.search).get('selectedLotId');

  // A user can open chat from an item page. Preserve only its ID; the server
  // resolves the full canonical lot before running detail/history functions.
  useEffect(() => {
    if (selectedLotId) {
      restoreBuyerChatFlowState({ context: { selectedLot: { id: selectedLotId } } });
    }
  }, [selectedLotId]);

  if (role === 'seller') return <SellerChat />;
  if (role === 'buyer') return <BuyerChat />;
  return <Navigate to={{ pathname: '/chat/buyer', search: location.search }} replace />;
}
