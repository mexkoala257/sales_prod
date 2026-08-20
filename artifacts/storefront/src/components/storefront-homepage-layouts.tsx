import type { Product, StorefrontConfig } from '@workspace/api-client-react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { StorefrontImage } from '@/components/storefront-image';

export type DiscoveryTileDisplay = {
  key: string;
  name: string;
  href: string;
  image?: { url?: string | null; altText?: string | null };
  tone: number;
};

type StorefrontHomepageProps = {
  config: StorefrontConfig;
  products: Product[];
  isLoading: boolean;
  featuredLimit: number;
  discoveryTiles: DiscoveryTileDisplay[];
  discoveryTitle: string;
  discoveryEyebrow: string;
  heroImageFailed: boolean;
  onHeroImageError: () => void;
  storePath: (path: string) => string;
};

function formatPrice(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function HeroImage({
  config,
  failed,
  onError,
  className,
  fallbackClassName,
}: {
  config: StorefrontConfig;
  failed: boolean;
  onError: () => void;
  className: string;
  fallbackClassName: string;
}) {
  if (config.heroImageUrl && !failed) {
    return <img src={config.heroImageUrl} alt="" className={className} onError={onError} />;
  }

  return <div className={fallbackClassName} />;
}

function ProductCard({
  product,
  href,
  variant,
}: {
  product: Product;
  href: string;
  variant: 'editorial' | 'lookbook' | 'grid';
}) {
  const image = product.images?.[0];
  const imageClass = variant === 'lookbook'
    ? 'aspect-[4/5] w-full object-cover transition duration-1000 group-hover:scale-[1.04]'
    : variant === 'grid'
      ? 'aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.04]'
      : 'h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]';

  if (variant === 'lookbook') {
    return (
      <Link href={href} className="group block">
        <div className="relative overflow-hidden bg-stone-200">
          <StorefrontImage src={image?.url} alt={image?.altText || product.name} className={imageClass} />
          {product.preOrder && <span className="absolute left-4 top-4 border border-white/70 bg-stone-950/70 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">Pre-order</span>}
        </div>
        <div className="flex items-start justify-between gap-4 px-1 pt-4">
          <div><h3 className="text-lg font-medium tracking-[-0.025em]">{product.name}</h3><p className="mt-1 text-xs text-stone-500">View details <ArrowUpRight className="inline h-3.5 w-3.5" /></p></div>
          <span className="shrink-0 text-sm tabular-nums">{formatPrice(product.price)}</span>
        </div>
      </Link>
    );
  }

  if (variant === 'grid') {
    return (
      <Link href={href} className="group block border-b border-r border-stone-200 bg-[#fcfcfa] p-3 transition-colors hover:bg-[var(--brand-accent)]/30 md:p-4">
        <div className="relative mb-4 overflow-hidden bg-stone-200">
          <StorefrontImage src={image?.url} alt={image?.altText || product.name} className={imageClass} />
          {product.preOrder && <span className="absolute left-2 top-2 bg-stone-950 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white">Pre-order</span>}
        </div>
        <div className="flex items-start justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
          <h3 className="line-clamp-2 pr-2">{product.name}</h3>
          <span className="shrink-0 tabular-nums">{formatPrice(product.price)}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block">
      <div className="relative mb-3 aspect-[4/5] overflow-hidden bg-stone-100">
        <StorefrontImage src={image?.url} alt={image?.altText || product.name} className={imageClass} />
        {product.preOrder && <span className="absolute left-3 top-3 bg-white px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-stone-900">Pre-order</span>}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-5">{product.name}</h3>
        <span className="shrink-0 text-sm tabular-nums">{formatPrice(product.price)}</span>
      </div>
      {product.compareAtPrice && product.compareAtPrice > product.price && <p className="mt-1 text-xs text-stone-400 line-through">{formatPrice(product.compareAtPrice)}</p>}
    </Link>
  );
}

function ProductLoadingGrid({ count, columns = 'md:grid-cols-4' }: { count: number; columns?: string }) {
  return <div className={`grid grid-cols-2 gap-x-4 gap-y-9 ${columns} md:gap-x-6`}>{Array.from({ length: count }).map((_, index) => <div key={index} className="space-y-3"><div className="storefront-skeleton aspect-[4/5]" /><div className="storefront-skeleton h-4 w-3/4" /><div className="storefront-skeleton h-3 w-1/3" /></div>)}</div>;
}

function EmptyProducts() {
  return <div className="border-y border-stone-200 py-16 text-center"><p className="font-serif text-2xl">The collection is taking shape.</p><p className="mt-2 text-sm text-stone-500">Check back soon for new arrivals.</p></div>;
}

function DiscoveryTiles({
  tiles,
  title,
  eyebrow,
  storePath,
  treatment,
}: {
  tiles: DiscoveryTileDisplay[];
  title: string;
  eyebrow: string;
  storePath: (path: string) => string;
  treatment: 'editorial' | 'lookbook' | 'grid';
}) {
  if (!tiles.length) return null;

  if (treatment === 'lookbook') {
    return (
      <section className="mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-32">
        <div className="mx-auto mb-12 max-w-2xl text-center"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">{eyebrow}</p><h2 className="font-serif text-4xl leading-tight tracking-[-0.045em] md:text-6xl">{title}</h2></div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-7">
          {tiles.map((tile, index) => (
            <a key={tile.key} href={storePath(tile.href)} className={`group relative block overflow-hidden bg-stone-200 ${index % 3 === 0 ? 'md:mt-0' : 'md:mt-16'} ${index === 0 ? 'md:row-span-2' : ''}`}>
              <div className={index === 0 ? 'aspect-[4/5] md:aspect-[4/5]' : 'aspect-[5/4]'}>
                <StorefrontImage src={tile.image?.url} alt={tile.image?.altText || tile.name} className="h-full w-full object-cover transition duration-1000 group-hover:scale-[1.05]" fallbackClassName={`storefront-category-fallback storefront-category-fallback-${tile.tone}`} fallbackLabel={tile.name.slice(0, 2)} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-5 text-white md:p-7"><span className="font-serif text-2xl md:text-3xl">{tile.name}</span><ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" /></div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  if (treatment === 'grid') {
    return (
      <section className="border-b border-stone-200 bg-[var(--brand-accent)]/15">
        <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-8">
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">{eyebrow}</p><h2 className="mt-1 text-xl font-bold uppercase tracking-[-0.04em] md:text-2xl">{title}</h2></div><Link href={storePath('/products')} className="text-[10px] font-bold uppercase tracking-[0.15em] underline underline-offset-4">View index</Link></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{tiles.map((tile) => <a key={tile.key} href={storePath(tile.href)} className="shrink-0 border border-stone-900 bg-[#fcfcfa] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] transition-colors hover:bg-stone-950 hover:text-white">{tile.name} <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></a>)}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1440px] px-5 pt-16 md:px-8 md:pt-24">
      <div className="mb-8 flex items-end justify-between gap-6"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">{eyebrow}</p><h2 className="text-3xl font-semibold tracking-[-0.045em] md:text-5xl">{title}</h2></div><Link href={storePath('/products')} className="hidden text-xs font-bold uppercase tracking-[0.16em] underline underline-offset-8 sm:inline-flex">View everything</Link></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{tiles.map((tile) => <a key={tile.key} href={storePath(tile.href)} className="group relative aspect-square overflow-hidden bg-stone-200"><StorefrontImage src={tile.image?.url} alt={tile.image?.altText || tile.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" fallbackClassName={`storefront-category-fallback storefront-category-fallback-${tile.tone}`} fallbackLabel={tile.name.slice(0, 2)} /><div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent" /><div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 text-white"><span className="text-sm font-medium">{tile.name}</span><ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" /></div></a>)}</div>
    </section>
  );
}

function ValueBand({ variant }: { variant: 'editorial' | 'lookbook' }) {
  const values = [['Made for togetherness', 'Thoughtful pieces for game nights, weekends, and everyday rituals.'], ['Choose with confidence', 'Clear product details, flexible options, and a simple shopping path.'], ['Shop your way', 'Discover by category, search the collection, and check out securely with Shopify.']];
  if (variant === 'lookbook') {
    return <section className="bg-stone-950 px-5 py-20 text-stone-100 md:px-8 md:py-28"><div className="mx-auto grid max-w-[1280px] gap-10 md:grid-cols-[0.7fr_1.3fr]"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400">The store promise</p><div className="grid gap-10 sm:grid-cols-3">{values.map(([title, description]) => <div key={title}><p className="font-serif text-2xl leading-tight">{title}</p><p className="mt-3 text-sm leading-6 text-stone-400">{description}</p></div>)}</div></div></section>;
  }
  return <section className="mx-auto max-w-[1440px] px-5 pt-16 md:px-8 md:pt-24"><div className="grid border-y border-stone-200 md:grid-cols-3">{values.map(([title, description], index) => <div key={title} className={`px-0 py-7 md:px-8 md:py-9 ${index > 0 ? 'md:border-l md:border-stone-200' : ''}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">0{index + 1}</p><h3 className="mt-4 text-xl font-semibold tracking-[-0.035em]">{title}</h3><p className="mt-3 max-w-xs text-sm leading-6 text-stone-500">{description}</p></div>)}</div></section>;
}

export function StorefrontEditorial(props: StorefrontHomepageProps) {
  const { config, products, isLoading, featuredLimit, discoveryTiles, discoveryTitle, discoveryEyebrow, heroImageFailed, onHeroImageError, storePath } = props;
  const sections = config.homepageSections || { showDiscovery: true, showValues: true, showFeatured: true };
  return <>
    <section className="mx-auto max-w-[1440px] px-0 md:px-4 md:pt-4"><div className="relative grid min-h-[620px] overflow-hidden bg-[var(--brand-accent)] md:min-h-[680px] md:grid-cols-[1.05fr_0.95fr]"><div className="relative z-10 flex items-end px-6 py-12 md:px-12 md:py-16"><div className="max-w-2xl">{config.heroEyebrow && <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-stone-700">{config.heroEyebrow}</p>}<h1 className="max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.065em] text-stone-950 sm:text-6xl md:text-7xl lg:text-8xl">{config.heroTitle || 'The pieces you reach for, on repeat.'}</h1><p className="mt-7 max-w-md text-base leading-7 text-stone-700 md:text-lg">{config.heroSubtitle || 'Considered essentials and new favorites, curated for everyday rituals.'}</p><Link href={storePath('/products')} className="storefront-button mt-9 inline-flex h-12 items-center gap-3 bg-[var(--brand-primary)] px-6 text-xs font-bold uppercase tracking-[0.15em] text-white transition-transform hover:-translate-y-0.5">{config.heroCtaLabel || 'Shop the collection'} <ArrowUpRight className="h-4 w-4" /></Link></div></div><div className="relative min-h-[360px] bg-stone-300 md:min-h-0"><HeroImage config={config} failed={heroImageFailed} onError={onHeroImageError} className="absolute inset-0 h-full w-full object-cover" fallbackClassName="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(255,255,255,0.7),transparent_0_32%),linear-gradient(135deg,rgba(255,255,255,0.2),rgba(0,0,0,0.11))]" /><div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 via-transparent to-transparent" /><div className="absolute bottom-6 right-6 border border-white/70 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white">Selected for now</div></div></div></section>
    {sections.showDiscovery && <DiscoveryTiles tiles={discoveryTiles} title={discoveryTitle} eyebrow={discoveryEyebrow} storePath={storePath} treatment="editorial" />}
    {sections.showValues && <ValueBand variant="editorial" />}
    {sections.showFeatured && <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-8 md:py-28"><div className="mb-10 grid gap-5 md:grid-cols-[1fr_auto] md:items-end md:gap-10"><div className="max-w-xl"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">The edit</p><h2 className="text-3xl font-semibold tracking-[-0.045em] md:text-5xl">{config.featuredSectionTitle || 'Featured arrivals'}</h2>{config.featuredSectionDescription && <p className="mt-4 text-sm leading-6 text-stone-500 md:text-base">{config.featuredSectionDescription}</p>}</div><Link href={storePath('/products')} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] underline underline-offset-8">{config.shopNavigationLabel || 'Shop'} all <ArrowUpRight className="h-4 w-4" /></Link></div>{isLoading ? <ProductLoadingGrid count={featuredLimit} /> : products.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4 md:gap-x-6">{products.slice(0, featuredLimit).map((product) => <ProductCard key={product.id} product={product} href={storePath(`/products/${product.id}`)} variant="editorial" />)}</div> : <EmptyProducts />}</section>}
  </>;
}

export function StorefrontLookbook(props: StorefrontHomepageProps) {
  const { config, products, isLoading, featuredLimit, discoveryTiles, discoveryTitle, discoveryEyebrow, heroImageFailed, onHeroImageError, storePath } = props;
  const sections = config.homepageSections || { showDiscovery: true, showValues: true, showFeatured: true };
  return <>
    <section className="relative flex min-h-[calc(100dvh-76px)] items-center justify-center overflow-hidden bg-stone-900 px-5 text-center text-white"><HeroImage config={config} failed={heroImageFailed} onError={onHeroImageError} className="absolute inset-0 h-full w-full object-cover" fallbackClassName="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.28),transparent_0_27%),linear-gradient(125deg,#24312b,#1c2024_54%,#6e584d)]" /><div className="absolute inset-0 bg-stone-950/45" /><div className="relative z-10 mx-auto max-w-4xl py-20">{config.heroEyebrow && <p className="mb-7 text-[10px] font-bold uppercase tracking-[0.28em] text-stone-200">{config.heroEyebrow}</p>}<h1 className="font-serif text-5xl leading-[0.9] tracking-[-0.055em] sm:text-6xl md:text-8xl lg:text-9xl">{config.heroTitle || 'The pieces you reach for, on repeat.'}</h1><p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-stone-100 md:text-xl md:leading-8">{config.heroSubtitle || 'Considered essentials and new favorites, curated for everyday rituals.'}</p><Link href={storePath('/products')} className="storefront-button mt-10 inline-flex h-14 items-center gap-3 bg-white px-8 text-xs font-bold uppercase tracking-[0.16em] text-stone-950 transition-transform hover:-translate-y-1">{config.heroCtaLabel || 'Shop the collection'} <ArrowUpRight className="h-4 w-4" /></Link></div><p className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">Scroll to explore</p></section>
    {sections.showDiscovery && <DiscoveryTiles tiles={discoveryTiles} title={discoveryTitle} eyebrow={discoveryEyebrow} storePath={storePath} treatment="lookbook" />}
    {sections.showValues && <ValueBand variant="lookbook" />}
    {sections.showFeatured && <section className="mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-32"><div className="mb-12 grid gap-5 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">A closer look</p><h2 className="font-serif text-4xl tracking-[-0.05em] md:text-6xl">{config.featuredSectionTitle || 'Featured arrivals'}</h2>{config.featuredSectionDescription && <p className="mx-auto max-w-xl text-sm leading-6 text-stone-500 md:text-base">{config.featuredSectionDescription}</p>}</div>{isLoading ? <ProductLoadingGrid count={featuredLimit} columns="md:grid-cols-2" /> : products.length ? <div className="grid gap-x-7 gap-y-14 md:grid-cols-2">{products.slice(0, Math.min(featuredLimit, 6)).map((product) => <ProductCard key={product.id} product={product} href={storePath(`/products/${product.id}`)} variant="lookbook" />)}</div> : <EmptyProducts />}<div className="mt-12 text-center"><Link href={storePath('/products')} className="inline-flex items-center gap-2 border-b border-stone-900 pb-2 text-xs font-bold uppercase tracking-[0.16em]">{config.shopNavigationLabel || 'Shop'} the full collection <ArrowUpRight className="h-4 w-4" /></Link></div></section>}
  </>;
}

export function StorefrontCollectionGrid(props: StorefrontHomepageProps) {
  const { config, products, isLoading, featuredLimit, discoveryTiles, discoveryTitle, discoveryEyebrow, storePath } = props;
  const sections = config.homepageSections || { showDiscovery: true, showValues: true, showFeatured: true };
  return <>
    <section className="border-b border-stone-200 bg-[var(--brand-accent)]"><div className="mx-auto max-w-[1440px] px-5 pb-9 pt-16 md:px-8 md:pb-14 md:pt-24"><div className="mb-8 flex items-start justify-between gap-5"><p className="max-w-xs text-[10px] font-bold uppercase leading-5 tracking-[0.16em] text-stone-600">{config.heroEyebrow || 'Current release · Online catalog'}</p><Link href={storePath('/products')} className="shrink-0 border border-stone-950 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors hover:bg-stone-950 hover:text-white">{config.heroCtaLabel || 'Shop the collection'} <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></div><h1 className="max-w-6xl text-5xl font-black uppercase leading-[0.82] tracking-[-0.075em] text-stone-950 sm:text-6xl md:text-[8.5vw]">{config.heroTitle || 'The pieces you reach for, on repeat.'}</h1>{config.heroSubtitle && <p className="mt-8 max-w-xl border-l-2 border-stone-950 pl-4 text-sm leading-6 text-stone-700 md:text-base">{config.heroSubtitle}</p>}</div></section>
    {sections.showDiscovery && <DiscoveryTiles tiles={discoveryTiles} title={discoveryTitle} eyebrow={discoveryEyebrow} storePath={storePath} treatment="grid" />}
    {sections.showFeatured && <section className="mx-auto max-w-[1440px]"><div className="flex items-end justify-between border-b border-stone-200 px-5 py-8 md:px-8"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Catalog selection</p><h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] md:text-5xl">{config.featuredSectionTitle || 'Featured arrivals'}</h2>{config.featuredSectionDescription && <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">{config.featuredSectionDescription}</p>}</div><span className="hidden text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 sm:block">{Math.min(products.length, featuredLimit)} / {products.length || '—'} shown</span></div>{isLoading ? <div className="p-5 md:p-8"><ProductLoadingGrid count={featuredLimit} columns="md:grid-cols-4 lg:grid-cols-5" /></div> : products.length ? <div className="grid grid-cols-2 border-l border-stone-200 md:grid-cols-4 lg:grid-cols-5">{products.slice(0, featuredLimit).map((product) => <ProductCard key={product.id} product={product} href={storePath(`/products/${product.id}`)} variant="grid" />)}</div> : <div className="px-5 py-8 md:px-8"><EmptyProducts /></div>}<div className="border-b border-stone-200 p-5 text-center md:p-8"><Link href={storePath('/products')} className="text-[10px] font-bold uppercase tracking-[0.16em] underline underline-offset-4">Open full product index <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></div></section>}
    {sections.showValues && <section className="mx-auto max-w-[1440px] border-b border-stone-200 px-5 py-10 md:px-8"><div className="grid gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:grid-cols-3"><span>01 · Curated catalog</span><span>02 · Secure Shopify checkout</span><span>03 · New pieces, regularly</span></div></section>}
  </>;
}