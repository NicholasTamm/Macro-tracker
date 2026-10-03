import { Redirect } from 'expo-router';

/** Legacy Journal route → Today (M1-11). */
export default function JournalRedirect() {
  return <Redirect href="/today" />;
}
