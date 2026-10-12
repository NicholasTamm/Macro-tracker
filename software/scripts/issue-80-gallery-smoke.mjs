import React from 'react';
import { createRoot } from 'react-dom/client';
import { ComponentGallery } from '../design-system/Gallery.tsx';

const requested = new URLSearchParams(window.location.search).get('theme');
const scheme = requested === 'dark' ? 'dark' : 'light';
const root = document.getElementById('root');

if (!root) throw new Error('missing gallery root');
createRoot(root).render(React.createElement(ComponentGallery, { forcedScheme: scheme }));
