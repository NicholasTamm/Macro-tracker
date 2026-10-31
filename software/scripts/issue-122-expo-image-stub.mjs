import React from 'react';

export function Image({ source, style, contentFit: _contentFit, ...props }) {
  return React.createElement('img', {
    ...props,
    src: typeof source === 'string' ? source : source?.uri,
    style: { ...style, objectFit: 'contain' },
  });
}
