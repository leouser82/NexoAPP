import Background from './components/Background.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Process from './components/Process.jsx'
import Proof from './components/Proof.jsx'
import Quote from './components/Quote.jsx'
import Services from './components/Services.jsx'
import Work from './components/Work.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'

export default function App() {
  return (
    <LanguageProvider>
      <Background />
      <Header />
      <main id="top">
        <Hero />
        <Proof />
        <Services />
        <Work />
        <Process />
        <Quote />
        <Contact />
      </main>
      <Footer />
    </LanguageProvider>
  )
}
