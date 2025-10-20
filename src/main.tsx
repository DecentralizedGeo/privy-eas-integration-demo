import React from 'react'
// Buffer polyfill for browser environments (used by ethers and some wallet providers)
import { Buffer } from 'buffer'
;(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
