import { Navigate, useParams } from 'react-router-dom';
import { BuyerChat } from '../buyer/BuyerChat';
import { SellerChat } from '../seller/SellerChat';

// Routes a chat visitor to the right conversation screen by role. Both screens render the same
// ChatScreen shell (see chat/ChatScreen.tsx) — only the data source, message schema, and message
// rendering differ per role. An unrecognised or missing role falls back to the buyer chat.
export function ChatPage() {
  const { role } = useParams<{ role: string }>();
  if (role === 'seller') return <SellerChat />;
  if (role === 'buyer') return <BuyerChat />;
  return <Navigate to="/chat/buyer" replace />;
}
