import { useState, useEffect } from 'react';
import { Link } from 'wouter';

interface StoreEntry {
  id: number;
  name: string;
  slug: string;
  logoText: string | null;
  primaryColor: string;
  accentColor: string;
  announcementBar: string | null;
}

interface FeatureFlags {
  featureB2CStorefront: boolean;
}

export default function StorefrontList() {
  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [storefrontEnabled, setStorefrontEnabled] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/storefront').then((r) => r.json()).catch(() => []),
      fetch('/api/feature-flags').then((r) => r.json()).catch(() => ({ featureB2CStorefront: true })),
    ]).then(([storeData, flags]: [StoreEntry[], FeatureFlags]) => {
      setStores(Array.isArray(storeData) ? storeData : []);
      setStorefrontEnabled((flags as FeatureFlags)?.featureB2CStorefront !== false);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-10">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-zinc-900 text-white mx-auto flex items-center justify-center font-bold text-xl tracking-tighter">
            SC
          </div>
          <h1 className="text-4xl font-serif tracking-tight">Platform Storefronts</h1>
          <p className="text-zinc-500 text-sm">Select a brand below to enter its storefront.</p>
        </div>

        <div className="grid gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-zinc-200 animate-pulse rounded" />
            ))
          ) : stores.length === 0 ? (
            <p className="text-center text-zinc-400 text-sm py-8">No active storefronts found.</p>
          ) : (
            stores.map((store) =>
              storefrontEnabled ? (
                <Link
                  key={store.id}
                  href={`/store/${store.slug}`}
                  className="group flex items-center justify-between p-5 bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-sm transition-all"
                  data-testid={`link-store-${store.slug}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 flex items-center justify-center text-xs font-bold tracking-widest shrink-0"
                      style={{ backgroundColor: store.primaryColor, color: store.accentColor }}
                    >
                      {store.logoText?.slice(0, 2).toUpperCase() ?? store.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">{store.name}</p>
                      {store.announcementBar && (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{store.announcementBar}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0">
                    /store/{store.slug}
                  </span>
                </Link>
              ) : (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-5 bg-white border border-zinc-200 opacity-60 cursor-not-allowed"
                  data-testid={`disabled-store-${store.slug}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 flex items-center justify-center text-xs font-bold tracking-widest shrink-0"
                      style={{ backgroundColor: store.primaryColor, color: store.accentColor }}
                    >
                      {store.logoText?.slice(0, 2).toUpperCase() ?? store.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">{store.name}</p>
                      {store.announcementBar && (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{store.announcementBar}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono uppercase tracking-widest bg-zinc-100 text-zinc-500 px-3 py-1 border border-zinc-200 shrink-0">
                    Coming Soon
                  </span>
                </div>
              )
            )
          )}
        </div>

        <div className="text-center pt-4">
          <Link
            href="/super-admin/login"
            className="text-xs font-mono uppercase tracking-widest text-zinc-400 hover:text-zinc-900 border border-transparent hover:border-zinc-200 transition-colors px-4 py-2 inline-block"
            data-testid="link-operator-access"
          >
            Operator Access Gateway
          </Link>
        </div>
      </div>
    </div>
  );
}
