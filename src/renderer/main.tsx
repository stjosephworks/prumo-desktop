import './index.css'
import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { I18nProvider, initialLocale } from './i18n/i18n.tsx'
import { router } from './router.tsx'

const root = document.getElementById('root')

if (root === null) throw new Error('no #root in index.html')

// The language comes from the main process before the first paint, so the window never flashes another one.
void initialLocale().then((locale) =>
  createRoot(root).render(
    <I18nProvider initial={locale}>
      <RouterProvider router={router} />
    </I18nProvider>,
  ),
)
