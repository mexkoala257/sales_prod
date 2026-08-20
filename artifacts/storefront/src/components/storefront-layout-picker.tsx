type HomepageLayout = 'editorial' | 'lookbook' | 'collection_grid';

const options: Array<{ value: HomepageLayout; label: string; description: string }> = [
  { value: 'editorial', label: 'Editorial', description: 'A balanced split-screen introduction with a considered shopping edit.' },
  { value: 'lookbook', label: 'Lookbook', description: 'A visual-first, immersive storefront for storytelling and slower discovery.' },
  { value: 'collection_grid', label: 'Collection Grid', description: 'A compact, product-forward layout built for quick, high-density browsing.' },
];

function LayoutPreview({ layout }: { layout: HomepageLayout }) {
  if (layout === 'lookbook') {
    return <div aria-hidden className="relative aspect-[16/9] overflow-hidden border border-stone-200 bg-stone-900 p-3"><div className="h-1/2 rounded-sm bg-stone-700" /><div className="absolute left-1/2 top-[22%] h-2 w-2/5 -translate-x-1/2 bg-white/90" /><div className="absolute left-1/2 top-[34%] h-1 w-1/4 -translate-x-1/2 bg-white/60" /><div className="mt-3 grid grid-cols-[1.35fr_0.65fr] gap-2"><div className="h-9 bg-stone-500" /><div className="mt-3 h-6 bg-stone-600" /></div></div>;
  }
  if (layout === 'collection_grid') {
    return <div aria-hidden className="aspect-[16/9] overflow-hidden border border-stone-200 bg-stone-50 p-3"><div className="h-3 w-4/5 bg-stone-900" /><div className="mt-2 h-1 w-1/2 bg-stone-400" /><div className="mt-3 grid grid-cols-5 border-l border-t border-stone-300">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-square border-b border-r border-stone-300 bg-stone-200 p-1"><div className="h-full w-full bg-stone-300" /></div>)}</div></div>;
  }
  return <div aria-hidden className="aspect-[16/9] overflow-hidden border border-stone-200 bg-stone-50 p-3"><div className="grid h-1/2 grid-cols-[1.1fr_0.9fr] gap-2"><div className="flex items-end bg-[var(--brand-accent)] p-2"><div><div className="h-1.5 w-14 bg-stone-900" /><div className="mt-1 h-1 w-9 bg-stone-500" /></div></div><div className="bg-stone-300" /></div><div className="mt-3 grid grid-cols-4 gap-1.5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square bg-stone-200" />)}</div></div>;
}

export function StorefrontLayoutPicker({
  value,
  onChange,
}: {
  value: HomepageLayout;
  onChange: (value: HomepageLayout) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label key={option.value} className={`group cursor-pointer border p-3 transition-all ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-input bg-background hover:border-primary/50'}`}>
            <input type="radio" name="homepage-layout" value={option.value} checked={selected} onChange={() => onChange(option.value)} className="sr-only" />
            <LayoutPreview layout={option.value} />
            <div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-semibold">{option.label}</span><span className={`h-3 w-3 rounded-full border ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} /></div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
          </label>
        );
      })}
    </div>
  );
}