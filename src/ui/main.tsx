import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Dashboard } from './dashboard.js';
import { CURRENT_DASHBOARD_VIEW_MODEL } from './fixtures/dashboard.js';
import './styles.css';

const root = document.querySelector('#root');
if (root === null) throw new Error('Agent Office root element is missing');

createRoot(root).render(
  <StrictMode>
    <Dashboard model={CURRENT_DASHBOARD_VIEW_MODEL} />
  </StrictMode>,
);
