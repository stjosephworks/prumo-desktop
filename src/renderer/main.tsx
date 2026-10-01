import './index.css'
import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n/i18n.tsx'
import { router } from './router.tsx'

const root = document.getElementById('root')

if (root === null) throw new Error('no #root in index.html')

createRoot(root).render(
  <I18nProvider>
    <RouterProvider router={router} />
  </I18nProvider>,
)
