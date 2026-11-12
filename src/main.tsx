import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UIProvider } from './lib/UIContext.tsx';
import { AuthProvider } from './components/AuthProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </AuthProvider>
  </StrictMode>,
);
