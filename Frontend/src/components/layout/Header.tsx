"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[--header-background] backdrop-blur-sm border-b border-[--border-color]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/vertexchain-logo.svg"
              alt="VertexChain Logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-semibold text-[--text-primary]">
              VertexChain
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4">
            <Link
              href="/map"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary] transition-colors rounded-lg hover:bg-[--hover-bg]"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              Map
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
