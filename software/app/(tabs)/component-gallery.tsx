import { Redirect } from 'expo-router';
import { ComponentGallery } from '@/design-system';

export default function ComponentGalleryScreen() {
  if (!__DEV__) {
    return <Redirect href="/today" />;
  }

  return <ComponentGallery />;
}
