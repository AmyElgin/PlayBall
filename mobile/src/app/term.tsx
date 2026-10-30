import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, H2, Loading, Screen, SheetHeader } from '../components/ui';
import { getCurrentTerm, saveTerm } from '../lib/api';
import type { Term } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Manager: first and last day of the current term. */
export default function TermDates() {
  const { data, loaded, error } = useLoad(getCurrentTerm, []);
  if (!loaded) return <Screen top={false}><SheetHeader /><Loading /></Screen>;
  return <TermForm term={data} loadError={error} />;
}

function TermForm({ term, loadError }: { term: Term | null; loadError: string | null }) {
  const [start, setStart] = useState(term?.starts_on ?? '');
  const [end, setEnd] = useState(term?.ends_on ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!isDate(start) || !isDate(end)) {
      setError('Type the dates like 2027-01-14.');
      return;
    }
    if (end <= start) {
      setError('The last day must be after the first day.');
      return;
    }
    setBusy(true);
    try {
      await saveTerm(term, start, end);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>Term dates</H2>
      <Body muted>Parents see every lesson in the term. Coaches use it when they give a lesson away for the rest of term.</Body>
      <Field label="First day of term" value={start} onChangeText={setStart} placeholder="2027-01-14" keyboardType="numbers-and-punctuation" />
      <Field label="Last day of term" value={end} onChangeText={setEnd} placeholder="2027-03-27" keyboardType="numbers-and-punctuation" />
      <ErrorText text={error ?? loadError} />
      <Button title="Save term dates" onPress={save} loading={busy} />
    </Screen>
  );
}
