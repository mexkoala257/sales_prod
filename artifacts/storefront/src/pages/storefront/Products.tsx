import { StorefrontLayout } from './Home';
import { useListStorefrontCategories, useListStorefrontProducts } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorefront } from '@/context/StorefrontContext';
import { StorefrontImage } from '@/components/storefront-image';

function Price({ value }: { value: number }) {
  return <>{value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</>;
}

export default function StorefrontProducts() {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, storePath: ctxStorePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  const sp = (p: string) => ctxStorePath(p, storeSlug);
  const initialParams = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(() => {
    const value = Number(initialParams.get('category'));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [sort, setSort] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>(() => {
    const value = initialParams.get('sort');
    return value === 'price-asc' || value === 'price-desc' || value === 'name' ? value : 'featured';
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products, isLoading } = useListStorefrontProducts(storeSlug, { query: { enabled: !!storeSlug } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: categories } = useListStorefrontCategories(storeSlug, { query: { enabled: !!storeSlug } as any });
  useEffect(() => {
    if (initialParams.get('focus') === 'search') searchInput.current?.focus();
  }, []);
  const filteredProducts = useMemo(() => (products || []).filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = categoryId === null || product.categories?.includes(categoryId);
    return matchesSearch && matchesCategory;
  }), [products, search, categoryId]);
  const sortedProducts = useMemo(() => [...filteredProducts].sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    if (sort === 'name') return a.name.localeCompare(b.name);
    return 0;
  }), [filteredProducts, sort]);
  const selectedCategory = categories?.find((category) => category.id === categoryId);

  const categoryMenu = (
    <div className="space-y-5">
      <div className="border-b border-stone-200 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Browse</p>
      </div>
      <button type="button" onClick={() => setCategoryId(null)} className={`block text-left text-sm transition-opacity ${categoryId === null ? 'font-semibold text-stone-950' : 'text-stone-500 hover:text-stone-950'}`}>All products</button>
      {categories?.map((category) => (
        <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} className={`flex w-full items-center justify-between text-left text-sm transition-opacity ${categoryId === category.id ? 'font-semibold text-stone-950' : 'text-stone-500 hover:text-stone-950'}`}>
          <span>{category.name}</span><span className="text-xs tabular-nums text-stone-400">{category.productCount}</span>
        </button>
      ))}
    </div>
  );

  return (
    <StorefrontLayout>
      <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-8 md:py-16">
        <div className="border-b border-stone-200 pb-8 md:pb-10">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Home / {selectedCategory?.name || 'Browse the collection'}</p>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div><h1 className="text-5xl font-semibold tracking-[-0.06em] md:text-7xl">{selectedCategory?.name || 'Shop all'}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">{selectedCategory ? `Explore ${selectedCategory.name.toLowerCase()} and find the next piece for your collection.` : 'A considered collection of goods made for play, gathering, and the everyday.'}</p></div>
            <div className="flex w-full gap-2 md:w-auto">
              <div className="relative flex-1 md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="h-11 w-full border border-stone-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-stone-900" /></div>
              <button type="button" onClick={() => setFiltersOpen(true)} className="grid h-11 w-11 place-items-center border border-stone-300 md:hidden" aria-label="Open filters"><SlidersHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="hidden lg:block">{categoryMenu}</aside>
          <div>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-5">
              <p className="text-xs font-medium text-stone-500"><span className="font-bold text-stone-950">{sortedProducts.length}</span> {sortedProducts.length === 1 ? 'item' : 'items'} available</p>
              <div className="flex items-center gap-2"><label htmlFor="catalog-sort" className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Sort</label><select id="catalog-sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 border border-stone-300 bg-white px-3 text-xs font-medium outline-none focus:border-stone-900"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A to Z</option></select></div>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="space-y-3"><div className="storefront-skeleton aspect-[4/5]" /><div className="storefront-skeleton h-4 w-3/4" /><div className="storefront-skeleton h-3 w-1/3" /></div>)}</div>
            ) : sortedProducts.length ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-x-6">
                {sortedProducts.map((product) => (
                  <Link key={product.id} href={sp(`/products/${product.id}`)} className="group block">
                    <div className="relative mb-3 aspect-[4/5] overflow-hidden bg-stone-100">
                      <StorefrontImage src={product.images?.[0]?.url} alt={product.images?.[0]?.altText || product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
                      {product.preOrder && <span className="absolute left-3 top-3 bg-white px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em]">Pre-order</span>}
                    </div>
                    <div className="flex gap-3"><h2 className="flex-1 text-sm font-medium leading-5">{product.name}</h2><span className="text-sm tabular-nums"><Price value={product.price} /></span></div>
                    {product.compareAtPrice && product.compareAtPrice > product.price && <p className="mt-1 text-xs text-stone-400 line-through"><Price value={product.compareAtPrice} /></p>}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border-y border-stone-200 py-24 text-center"><p className="font-serif text-2xl">Nothing found.</p><p className="mt-2 text-sm text-stone-500">Try another search or clear your filters.</p>{(search || categoryId !== null) && <button type="button" className="mt-6 text-xs font-bold uppercase tracking-[0.16em] underline underline-offset-4" onClick={() => { setSearch(''); setCategoryId(null); }}>Clear filters</button>}</div>
            )}
          </div>
        </div>
      </div>
      {filtersOpen && <div className="fixed inset-0 z-[60] bg-stone-950/30 lg:hidden" onClick={() => setFiltersOpen(false)}><aside className="absolute left-0 top-0 h-full w-[min(320px,85vw)] bg-[#fcfcfa] p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-10 flex items-center justify-between"><p className="text-sm font-semibold">Filters</p><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X className="h-5 w-5" /></button></div>{categoryMenu}</aside></div>}
    </StorefrontLayout>
  );
}