import { Routes, Route } from 'react-router-dom';
import SmoothScrollProvider from '@/components/home/SmoothScrollProvider';
import CustomCursor from '@/components/home/CustomCursor';
import SableWorldBackground from '@/components/home/SableWorldBackground';
import Home from '@/pages/Home';

export default function App() {
  return (
    <SmoothScrollProvider>
      <SableWorldBackground />
      <CustomCursor />
      <div className="relative z-10 w-full min-w-full">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </SmoothScrollProvider>
  );
}
