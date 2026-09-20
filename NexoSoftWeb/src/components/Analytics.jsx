import { useEffect } from 'react'

const GA_ID = 'G-THPZP8MCSZ'

function sendPage() {
  if (typeof window.gtag !== 'function') return
  window.gtag('config', GA_ID, {
    page_path: window.location.pathname + window.location.search + window.location.hash,
    page_title: document.title,
    page_location: window.location.href,
  })
}

export default function Analytics() {
  useEffect(() => {
    const onHash = () => sendPage()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return null
}
