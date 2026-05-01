import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          duration={3000}
          toastOptions={{
            style: {
              background: '#089527',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '12px',
              fontWeight: 600,
              lineHeight: '16px',
              padding: '16px',
              gap: '8px',
              maxWidth: '345px',
            }
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
