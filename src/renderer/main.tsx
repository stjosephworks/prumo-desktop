import './index.css'
import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { router } from './router.tsx'

const root = document.getElementById('root')

if (root === null) throw new Error('no #root in index.html')

createRoot(root).render(<RouterProvider router={router} />)
