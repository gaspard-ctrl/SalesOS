import { ChatWorkspace } from "./_components/chat-workspace";

// Nouveau chat. Dès le premier message, l'URL devient /c/<id> (voir
// ChatWorkspace) pour que la conversation soit adressable et partageable.
export default function HomePage() {
  return <ChatWorkspace />;
}
