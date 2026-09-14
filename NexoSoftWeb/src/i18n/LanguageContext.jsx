import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { copies } from './copy.js'
import { detectLang, LANG_KEY, LANGS } from './langs.js'

const LanguageContext = createContext({
  lang: 'es',
  setLang: () => {},
  copy: copies.es,
  langs: LANGS,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => detectLang())

  useEffect(() => {
    document.documentElement.lang = lang
    const copy = copies[lang] || copies.es
    if (copy.meta?.title) document.title = copy.meta.title
    const desc = document.querySelector('meta[name="description"]')
    if (desc && copy.meta?.description) desc.setAttribute('content', copy.meta.description)
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // ignore
    }
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang: setLangState,
      copy: copies[lang] || copies.es,
      langs: LANGS,
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useCopy() {
  return useContext(LanguageContext)
}
