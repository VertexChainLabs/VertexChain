import type { Metadata } from "next";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";

/**
 * Metadata for the landing page including font preloads
 * Preloads Geist Sans and Mono variants to optimize LCP (Largest Contentful Paint)
 * Font subsets are loaded based on unicode-range to reduce payload for regional users
 */
export const metadata: Metadata = {
  title: "VertexChain - Hyperlocal Micro-Messaging",
  description: "VertexChain - Anonymous, location-aware micro-messaging on Stellar",
};

export default function LandingPage() {
  return (
    <div className="bg-[#111827] text-gray-200">
      <Features />
      <Footer />
    </div>
  );
}
