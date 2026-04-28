import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import axios from 'axios';
import App from './App.tsx';
import './index.css';
import { auth } from './lib/firebase.ts';
import { toast } from 'sonner';

// Global catch for "company workspace required" — surfaces a toast instead of a silent crash
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message === 'A company workspace is required for this action.') {
    toast.error('Workspace not linked. Refresh the page — if this keeps happening, sign out and back in.');
    event.preventDefault();
  }
});

axios.interceptors.request.use(async (config) => {
  if (config.url?.startsWith('/api/') && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
