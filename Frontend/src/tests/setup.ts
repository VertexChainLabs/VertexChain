import '@testing-library/jest-dom'
import * as axeMatchers from 'vitest-axe/matchers'
import { expect, vi } from 'vitest'

expect.extend(axeMatchers)

// Mock next-intl for tests — returns a sensible default for each key
// so tests don't need NextIntlClientProvider wrappers.
const englishDefaults: Record<string, string> = {
  'nav.map': 'Map',
  'nav.logoAlt': 'VertexChain Logo',
  'nav.brandName': 'VertexChain',
  'features.badge': 'Core Features',
  'features.heading': 'The Hyperlocal Information Hub',
  'features.subtitle': 'VertexChain brings together anonymous, real-world events and conversations into a single, interactive map.',
  'featureCards.anonymous.title': 'Truly Anonymous',
  'featureCards.anonymous.description': 'No accounts, no tracking. Secured by the blockchain.',
  'featureCards.hyperlocal.title': 'Hyperlocal Focus',
  'featureCards.hyperlocal.description': "Filter out the noise. See what's relevant to your immediate area.",
  'featureCards.realtime.title': 'Real-Time & Unfiltered',
  'featureCards.realtime.description': 'Get live updates as they happen from your community.',
  'cta.heading': 'Ready to See What\'s Happening?',
  'cta.body': 'From the bustling streets of Lagos to the quiet corners of your neighborhood, discover and share what\'s happening right now. Your community is waiting.',
  'cta.button': 'Explore the Live Map',
  'footer.copyright': '© {year} VertexChain. Powered by the Stellar Network.',
  'footer.privacy': 'Privacy',
  'footer.terms': 'Terms',
  'footer.docs': 'Docs',
  'title': 'VertexChain - Hyperlocal Micro-Messaging',
  'description': 'VertexChain - Anonymous, location-aware micro-messaging on Stellar',
  'skipToContent': 'Skip to content',
};

vi.mock('next-intl', () => {
  const translate = (key: string, values?: Record<string, unknown>, elements?: Record<string, (chunks: React.ReactNode) => React.ReactNode>) => {
    let val = englishDefaults[key] ?? key.split('.').pop() ?? key;
    if (values) {
      val = val.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
    }
    // Strip markup tags for test rendering
    val = val.replace(/<\/?[^>]+>/g, '');
    return val;
  };

  const t = translate as ReturnType<typeof translate> & {
    rich: (key: string, elements?: Record<string, (chunks: React.ReactNode) => React.ReactNode>) => React.ReactNode;
  };

  // `t.rich(key, elements, values?)` — strips tags and substitutes variables
  t.rich = (key: string, elements?: Record<string, (chunks: React.ReactNode) => React.ReactNode>, values?: Record<string, unknown>) => {
    return translate(key, values, elements);
  };

  return {
    useTranslations: () => t,
    useLocale: () => 'en',
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
    hasLocale: () => true,
  };
});

vi.mock('next-intl/server', () => ({
  getTranslations: () => async (key: string) => key,
  getMessages: () => async ({}),
}));

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: vi.fn(),
    usePathname: () => '/',
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    getPathname: () => '/',
  }),
}));