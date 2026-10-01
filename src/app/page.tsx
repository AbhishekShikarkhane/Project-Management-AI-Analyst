import { DataProvider } from '@/context/DataContext';
import { ChatInterface } from '@/components/ChatInterface';

export default function Home() {
  return (
    <DataProvider>
      <ChatInterface />
    </DataProvider>
  );
}
