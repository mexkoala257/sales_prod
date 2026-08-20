import { useEffect, useState } from 'react';
import {
  getGetAdminStorefrontDesignQueryKey,
  useGetAdminStorefrontDesign,
  useUpdateAdminStorefrontDesign,
  type StorefrontDesign,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/ui';
import { StorefrontLayoutPicker } from '@/components/storefront-layout-picker';

const defaultSections = { showDiscovery: true, showValues: true, showFeatured: true };

export default function AdminStorefrontDesign() {
  const queryClient = useQueryClient();
  const { data: design, isLoading } = useGetAdminStorefrontDesign();
  const updateDesign = useUpdateAdminStorefrontDesign();
  const [formData, setFormData] = useState<StorefrontDesign | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (design) setFormData({ ...design, homepageSections: design.homepageSections || defaultSections });
  }, [design]);

  const updateField = <K extends keyof StorefrontDesign>(field: K, value: StorefrontDesign[K]) => {
    setFormData((current) => current ? { ...current, [field]: value } : current);
    setSaved(false);
  };

  const save = () => {
    if (!formData) return;
    setSaveError('');
    setSaved(false);
    updateDesign.mutate(
      {
        data: {
          ...formData,
          heroEyebrow: formData.heroEyebrow || null,
          heroTitle: formData.heroTitle || null,
          heroSubtitle: formData.heroSubtitle || null,
          heroImageUrl: formData.heroImageUrl || null,
          heroCtaLabel: formData.heroCtaLabel || null,
          shopNavigationLabel: formData.shopNavigationLabel || null,
          featuredSectionTitle: formData.featuredSectionTitle || null,
          featuredSectionDescription: formData.featuredSectionDescription || null,
        },
      },
      {
        onSuccess: (updated) => {
          setFormData(updated);
          queryClient.setQueryData(getGetAdminStorefrontDesignQueryKey(), updated);
          setSaved(true);
        },
        onError: () => setSaveError('We could not save your storefront design. Check the fields and try again.'),
      },
    );
  };

  if (isLoading || !formData) return <div className="animate-pulse">Loading storefront design...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Storefront Design</h1><p className="mt-1 text-muted-foreground">Choose your home page layout and shape the content shoppers see first.</p></div>
        <Button className="rounded-none" onClick={save} disabled={updateDesign.isPending}>{updateDesign.isPending ? 'Saving…' : 'Save storefront design'}</Button>
      </div>
      {saveError && <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{saveError}</p>}
      {saved && <p role="status" className="border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-700">Storefront design saved. Shoppers will see your updated home page.</p>}

      <Card className="rounded-none shadow-sm">
        <CardHeader><CardTitle>Homepage Layout</CardTitle><p className="text-sm text-muted-foreground">Each layout uses your own products and discovery choices in a different way.</p></CardHeader>
        <CardContent><StorefrontLayoutPicker value={formData.homepageLayout} onChange={(homepageLayout) => updateField('homepageLayout', homepageLayout)} /></CardContent>
      </Card>

      <Card className="rounded-none shadow-sm">
        <CardHeader><CardTitle>Homepage Sections</CardTitle><p className="text-sm text-muted-foreground">Control the supporting moments around your campaign and products.</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            ['showDiscovery', 'Discovery links', 'Show your chosen categories and collection shortcuts.'],
            ['showValues', 'Store story', 'Show the brand reassurance and supporting messages.'],
            ['showFeatured', 'Featured products', 'Show the product selection from your catalog.'],
          ].map(([key, label, description]) => {
            const sectionKey = key as keyof typeof defaultSections;
            return <label key={key} className="flex cursor-pointer gap-3 border p-4 transition-colors hover:bg-muted/30"><input type="checkbox" className="mt-1 h-4 w-4" checked={formData.homepageSections[sectionKey]} onChange={(event) => updateField('homepageSections', { ...formData.homepageSections, [sectionKey]: event.target.checked })} /><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></label>;
          })}
        </CardContent>
      </Card>

      <Card className="rounded-none shadow-sm">
        <CardHeader><CardTitle>Campaign Copy</CardTitle><p className="text-sm text-muted-foreground">These shared fields adapt automatically to the layout you select.</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Shop Navigation Label</Label><Input value={formData.shopNavigationLabel || ''} onChange={(event) => updateField('shopNavigationLabel', event.target.value)} maxLength={30} className="rounded-none" /></div><div className="space-y-2"><Label>Hero Eyebrow</Label><Input value={formData.heroEyebrow || ''} onChange={(event) => updateField('heroEyebrow', event.target.value)} maxLength={60} className="rounded-none" /></div></div>
          <div className="space-y-2"><Label>Hero Title</Label><Input value={formData.heroTitle || ''} onChange={(event) => updateField('heroTitle', event.target.value)} maxLength={120} className="rounded-none" /></div>
          <div className="space-y-2"><Label>Hero Description</Label><Textarea value={formData.heroSubtitle || ''} onChange={(event) => updateField('heroSubtitle', event.target.value)} maxLength={280} className="min-h-24 rounded-none" /></div>
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Hero Call-to-Action</Label><Input value={formData.heroCtaLabel || ''} onChange={(event) => updateField('heroCtaLabel', event.target.value)} maxLength={40} className="rounded-none" /></div><div className="space-y-2"><Label>Hero Image URL</Label><Input value={formData.heroImageUrl || ''} onChange={(event) => updateField('heroImageUrl', event.target.value)} type="url" className="rounded-none" /></div></div>
        </CardContent>
      </Card>

      <Card className="rounded-none shadow-sm">
        <CardHeader><CardTitle>Featured Product Moment</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Section Title</Label><Input value={formData.featuredSectionTitle || ''} onChange={(event) => updateField('featuredSectionTitle', event.target.value)} maxLength={80} className="rounded-none" /></div><div className="space-y-2"><Label>Product Count</Label><Input type="number" min={1} max={12} value={formData.featuredProductLimit} onChange={(event) => updateField('featuredProductLimit', Math.min(12, Math.max(1, Number(event.target.value) || 1)))} className="rounded-none" /></div></div>
          <div className="space-y-2"><Label>Section Description</Label><Textarea value={formData.featuredSectionDescription || ''} onChange={(event) => updateField('featuredSectionDescription', event.target.value)} maxLength={220} className="min-h-20 rounded-none" /></div>
        </CardContent>
      </Card>
    </div>
  );
}