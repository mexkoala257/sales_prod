/**
 * StorefrontContext — domain-aware storefront resolution.
 *
 * When the React app loads on a custom domain (e.g. apexathletics.com) the
 * storeSlug is not available in the URL.  This context resolves it once via
 * GET /api/storefront/resolve?domain=<hostname> and makes it available to all
 * storefront pages.  On the platform's own domain the slug comes from the URL
 * params as usual.
 *
 * Platform hosts (never treated as custom brand domains):
 *   • localhost / 127.0.0.1
 *   • *.replit.dev, *.repl.co, *.replit.app
 *   • The value of VITE_PLATFORM_HOST (set at build time for self-hosted deployments)
 *
 * www handling:
 *   "www.brand.com" is normalized to "brand.com" before the resolve call so
 *   the lookup always matches the apex domain stored in the DB.  Operators
 *   should configure the apex form in the Custom Domain field and set up an
 *   Nginx redirect for www → apex (documented in DEPLOY.md).
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

/** Exact hostnames / suffixes that belong to the platform itself. */
const PLATFORM_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '.replit.dev',
  '.repl.co',
  '.replit.app',
];

/**
 * Strip the "www." prefix so "www.brand.com" and "brand.com" both look up the
 * same DB row.
 */
export function canonicalHost(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

/**
 * Returns true when `hostname` is the platform itself (never a custom brand domain).
 *
 * Checks:
 *  1. Built-in localhost / Replit suffix list
 *  2. VITE_PLATFORM_HOST — set this in the storefront's .env to your self-hosted
 *     platform domain (e.g. VITE_PLATFORM_HOST=platform.example.com).
 */
export function isPlatformHost(hostname: string): boolean {
  const h = canonicalHost(hostname);

  if (PLATFORM_PATTERNS.some((p) => (p.startsWith('.') ? h.endsWith(p) : h === p))) {
    return true;
  }

  // VITE_PLATFORM_HOST is replaced at build time by Vite.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — import.meta.env is a Vite global
  const configuredPlatformHost: string | undefined = import.meta.env?.VITE_PLATFORM_HOST;
  if (configuredPlatformHost && h === canonicalHost(configuredPlatformHost)) {
    return true;
  }

  return false;
}

interface StorefrontContextValue {
  /** The store slug resolved from the domain (custom-domain mode) or from URL params (platform mode). */
  slug: string | null;
  /** True when the app is running on a brand's custom domain, not the platform host. */
  isCustomDomain: boolean;
  /** True while the domain → slug resolution is in flight (custom-domain mode only). */
  resolving: boolean;
  /**
   * Produces a URL path for a storefront page.
   *   storePath('/products')               → '/products'              (custom domain)
   *   storePath('/products', 'apex')        → '/store/apex/products'  (platform domain)
   */
  storePath: (path: string, slugOverride?: string) => string;
}

const StorefrontContext = createContext<StorefrontContextValue>({
  slug: null,
  isCustomDomain: false,
  resolving: false,
  storePath: (path) => path,
});

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const rawHostname = window.location.hostname;
  const isCustomDomain = !isPlatformHost(rawHostname);
  // Use canonical (www-stripped) hostname for the resolve lookup
  const resolveHostname = canonicalHost(rawHostname);

  const [slug, setSlug] = useState<string | null>(null);
  const [resolving, setResolving] = useState(isCustomDomain);

  useEffect(() => {
    if (!isCustomDomain) return;
    fetch(`/api/storefront/resolve?domain=${encodeURIComponent(resolveHostname)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => { if (config?.slug) setSlug(config.slug); })
      .catch(() => {})
      .finally(() => setResolving(false));
  }, [resolveHostname, isCustomDomain]);

  const storePath = (path: string, slugOverride?: string): string => {
    if (isCustomDomain) return path;
    const s = slugOverride ?? slug;
    return s ? `/store/${s}${path}` : path;
  };

  return (
    <StorefrontContext.Provider value={{ slug, isCustomDomain, resolving, storePath }}>
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}
