import NavigationBar from '@/components/home/NavigationBar';
import Footer from '@/components/home/Footer';
import HeroSection from '@/sections/home/HeroSection';
import CapabilitiesSection from '@/sections/home/CapabilitiesSection';
import HowItWorksSection from '@/sections/home/HowItWorksSection';
import EcosystemSection from '@/sections/home/EcosystemSection';
import FinalCTASection from '@/sections/home/FinalCTASection';

export default function Home() {
  return (
    <>
      <NavigationBar />
      <main>
        <HeroSection />
        <CapabilitiesSection />
        <HowItWorksSection />
        <EcosystemSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  );
}
