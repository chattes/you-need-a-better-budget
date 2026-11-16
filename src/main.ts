import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const app = mount(App, {
  target: document.getElementById('app')!
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

export default app;
