import { createElement, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';

it('renders a component with hooks using the installed React renderer', () => {
  function Status() {
    const [status] = useState('Ready');
    return createElement('output', null, status);
  }
  expect(renderToString(createElement(Status))).toBe('<output>Ready</output>');
});
