/** UI entry point. */
import { render } from 'solid-js/web';
import { App } from './App.tsx';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import './styles/theme.css';

const root = document.getElementById('root');
if (root !== null) {
  render(() => <App />, root);
}
