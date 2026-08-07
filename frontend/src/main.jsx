import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/navigation.css'
import './styles/transitions.css'
import './styles/ipad.css'
import './styles/dialog.css'
import './styles/calendar.css'
import './styles/themes.css'
import App from './App.jsx'
import { applySiteTheme, getSiteTheme } from './utils/theme'

applySiteTheme(getSiteTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
