import { ChildProvider } from '../../components/ChildPicker';
import { TabsLayout } from '../../components/TabsLayout';

export default function ParentTabs() {
  return (
    <ChildProvider>
      <TabsLayout
        tabs={[
          { name: 'home', title: 'Home', icon: 'home-outline' },
          { name: 'dates', title: 'Term dates', icon: 'calendar-outline' },
          { name: 'messages', title: 'Messages', icon: 'chatbubble-outline' },
        ]}
      />
    </ChildProvider>
  );
}
