import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import CTA from "@/components/landing/CTA";

export default function LandingPage() {
  return (
    <div className="bg-[#111827] text-gray-200">
      <Features />
      <CTA />
      <Footer />
    </div>
  );
}
