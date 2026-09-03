import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ResetPasswordPage } from './components/ResetPasswordPage.tsx';
import './index.css';

// Minimal path-based routing (this project intentionally has no router
// library). The password-reset email links to /reset-password?token=... and
// the Express server serves the SPA for every path, so we render the
// standalone Reset Password page for that route instead of the full app.
const isResetPasswordRoute =
  typeof window !== 'undefined' && window.location.pathname === '/reset-password';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isResetPasswordRoute ? <ResetPasswordPage /> : <App />}
  </StrictMode>,
);
