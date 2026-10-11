import React from 'react';
import { createRoot } from 'react-dom/client';
import Settings from '../../../../app/(tabs)/settings';
import { SmokeUserDataProvider } from './smokeUserDataProvider';

const root = document.getElementById('root');
if (!root) throw new Error('missing smoke root');

createRoot(root).render(
  <SmokeUserDataProvider>
    <Settings />
  </SmokeUserDataProvider>,
);
