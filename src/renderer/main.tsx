import './index.css'
import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { I18nProvider, localeReady } from './i18n/i18n.tsx'
import { router } from './router.tsx'

const root = document.getElementById('root')

if (root === null) throw new Error('no #root in index.html')

// The language comes from the main process before the first paint, so the window never flashes another one.
void localeReady.then(() =>
  createRoot(root).render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  ),
)
