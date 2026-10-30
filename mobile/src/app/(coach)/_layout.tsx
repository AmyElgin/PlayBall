import { TabsLayout } from '../../components/TabsLayout';

export default function CoachTabs() {
  return (
    <TabsLayout
      tabs={[
        { name: 'lessons', title: 'Lessons', icon: 'calendar-outline' },
        { name: 'hours', title: 'Hours', icon: 'time-outline' },
        { name: 'swaps', title: 'Swaps', icon: 'swap-horizontal' },
      ]}
    />
  );
}
