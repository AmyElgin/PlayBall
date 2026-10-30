import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Body, Empty, ErrorText, Greeting, List, Loading, Screen } from '../../components/ui';
import { getMessages, markMessagesRead } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/dates';
import { useColors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

export default function Messages() {
  const c = useColors();
  const { profile } = useAuth();
  const id = profile!.id;
  const { data, error, refreshing, refresh } = useLoad(() => getMessages(id), [id]);

  // Opening this tab marks everything as read.
  useFocusEffect(useCallback(() => { markMessagesRead(id).catch(() => {}); }, [id]));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting title="Messages" />
      <ErrorText text={error} />
      {!data && !error ? <Loading /> : null}
      {data && !data.length ? <Empty text="No messages yet. You’ll get one here if a lesson is cancelled." /> : null}
      {data?.length ? (
        <List>
          {data.map((m, i) => (
            <View
              key={m.id}
              style={{
                padding: 16, gap: 3,
                borderBottomWidth: i === data.length - 1 ? 0 : 1, borderBottomColor: c.line,
                backgroundColor: m.read_at ? undefined : m.kind === 'cancelled' ? c.redSoft : c.primarySoft,
              }}
            >
              <Body bold small>{m.title}</Body>
              <Body small>{m.body}</Body>
              <Body small muted>{timeAgo(m.created_at)}</Body>
            </View>
          ))}
        </List>
      ) : null}
    </Screen>
  );
}
