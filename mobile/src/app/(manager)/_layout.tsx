import { TabsLayout } from '../../components/TabsLayout';

export default function ManagerTabs() {
  return (
    <TabsLayout
      tabs={[
        { name: 'schedule', title: 'Schedule', icon: 'calendar-outline' },
        { name: 'coaches', title: 'Coaches', icon: 'people-outline' },
        { name: 'schools', title: 'Schools', icon: 'school-outline' },
      ]}
    />
  );
}
