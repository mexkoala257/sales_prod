import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useCreateStore, useUpdateStore, useGetStore, useListStorefrontCategories, StoreInputFontFamily, StoreUpdateFontFamily, StoreInputButtonStyle, StoreUpdateButtonStyle, StoreInputHomepageLayout, StoreUpdateHomepageLayout, type StorefrontDiscoveryTile } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { getListStoresQueryKey } from '@workspace/api-client-react';
import { Globe } from 'lucide-react';
import { DiscoveryTileEditor } from '@/components/DiscoveryTileEditor';
import { StorefrontLayoutPicker } from '@/components/storefront-layout-picker';

export default function SuperAdminStoreForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: store, isLoading } = useGetStore(id || '', { query: { enabled: isEditing } as any });
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const [saveError, setSaveError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    customDomain: '',
    primaryColor: '#000000',
    accentColor: '#f3f4f6',
    fontFamily: StoreInputFontFamily.Inter as StoreInputFontFamily | StoreUpdateFontFamily,
    heroEyebrow: '',
    heroTitle: '',
    heroSubtitle: '',
    heroImageUrl: '',
    heroCtaLabel: 'Shop the collection',
    shopNavigationLabel: 'Shop',
    featuredSectionTitle: 'Featured arrivals',
    featuredSectionDescription: '',
    featuredProductLimit: 4,
    discoveryTiles: [] as StorefrontDiscoveryTile[],
    homepageLayout: StoreInputHomepageLayout.editorial as StoreInputHomepageLayout | StoreUpdateHomepageLayout,
    homepageSections: { showDiscovery: true, showValues: true, showFeatured: true },
    buttonStyle: StoreInputButtonStyle.square as StoreInputButtonStyle | StoreUpdateButtonStyle,
    demoMode: false,
    isActive: true,
  });

  useEffect(() => {
    if (store && isEditing) {
      setFormData({
        name: store.name,
        slug: store.slug,
        customDomain: store.customDomain ?? '',
        primaryColor: store.primaryColor || '#000000',
        accentColor: store.accentColor || '#f3f4f6',
        fontFamily: store.fontFamily as StoreInputFontFamily,
        heroEyebrow: store.heroEyebrow || '',
        heroTitle: store.heroTitle || '',
        heroSubtitle: store.heroSubtitle || '',
        heroImageUrl: store.heroImageUrl || '',
        heroCtaLabel: store.heroCtaLabel || 'Shop the collection',
        shopNavigationLabel: store.shopNavigationLabel || 'Shop',
        featuredSectionTitle: store.featuredSectionTitle || 'Featured arrivals',
        featuredSectionDescription: store.featuredSectionDescription || '',
        featuredProductLimit: store.featuredProductLimit || 4,
        discoveryTiles: store.discoveryTiles || [],
        homepageLayout: (store.homepageLayout || StoreInputHomepageLayout.editorial) as StoreInputHomepageLayout,
        homepageSections: store.homepageSections || { showDiscovery: true, showValues: true, showFeatured: true },
        buttonStyle: (store.buttonStyle || StoreInputButtonStyle.square) as StoreInputButtonStyle,
        demoMode: store.demoMode,
        isActive: store.isActive,
      });
    }
  }, [store, isEditing]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: categories, isLoading: categoriesLoading } = useListStorefrontCategories(formData.slug, { query: { enabled: isEditing && !!formData.slug } as any });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');

    // Normalise: strip https://, trailing slashes, lowercase, strip www. prefix
    // so the DB always stores the bare apex domain (e.g. "apexathletics.com")
    const rawDomain = formData.customDomain.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')   // strip any path
      .toLowerCase()
      .replace(/^www\./, ''); // strip www. prefix

    // Send null when the domain is cleared so the unique constraint isn't violated
    const domain: string | null = rawDomain || null;
    const data = {
      ...formData,
      customDomain: domain,
      fontFamily: formData.fontFamily || (store?.fontFamily as StoreInputFontFamily) || StoreInputFontFamily.Inter,
      buttonStyle: formData.buttonStyle || (store?.buttonStyle as StoreInputButtonStyle) || StoreInputButtonStyle.square,
    };

    if (isEditing) {
      updateStore.mutate(
        { storeId: id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
            setLocation('/super-admin/stores');
          },
          onError: () => setSaveError('We could not save this store. Check each field and try again.'),
        },
      );
    } else {
      createStore.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
            setLocation('/super-admin/stores');
          },
          onError: () => setSaveError('We could not save this store. Check each field and try again.'),
        },
      );
    }
  };

  if (isEditing && isLoading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{isEditing ? 'Configure Store' : 'Deploy New Store'}</h1>
        <p className="text-muted-foreground mt-1">Platform tenant configuration parameters.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="rounded-none shadow-sm">
          <CardHeader>
            <CardTitle>Identity & Routing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Store Name</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Acme Corp" className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label>URL Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} required placeholder="acme" className="rounded-none font-mono" disabled={isEditing} />
                <p className="text-xs text-muted-foreground">Dev path: /store/{formData.slug || 'slug'}</p>
              </div>
            </div>

            {/* Custom Domain */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Custom Domain
              </Label>
              <Input
                value={formData.customDomain}
                onChange={e => setFormData({ ...formData, customDomain: e.target.value })}
                placeholder="apexathletics.com"
                className="rounded-none font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Point this domain's DNS A record at your server IP. Leave blank to use the slug-based URL only.
                When set, consumers visiting this domain will see this storefront without any platform branding.
              </p>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="rounded-none border-input" />
                <span className="text-sm font-medium">Active (Publicly routing)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.demoMode} onChange={e => setFormData({ ...formData, demoMode: e.target.checked })} className="rounded-none border-input" />
                <span className="text-sm font-medium">Demo Mode</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none shadow-sm">
          <CardHeader>
            <CardTitle>Homepage Layout</CardTitle>
            <p className="text-sm text-muted-foreground">Choose how this store’s campaign, discovery links, and products are arranged. Existing storefronts keep Editorial until changed.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <StorefrontLayoutPicker value={formData.homepageLayout} onChange={(homepageLayout) => setFormData({ ...formData, homepageLayout })} />
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['showDiscovery', 'Discovery links'],
                ['showValues', 'Store story'],
                ['showFeatured', 'Featured products'],
              ].map(([key, label]) => {
                const sectionKey = key as keyof typeof formData.homepageSections;
                return <label key={key} className="flex cursor-pointer items-center gap-3 border p-3 text-sm transition-colors hover:bg-muted/30"><input type="checkbox" checked={formData.homepageSections[sectionKey]} onChange={(event) => setFormData({ ...formData, homepageSections: { ...formData.homepageSections, [sectionKey]: event.target.checked } })} />{label}</label>;
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none shadow-sm">
          <CardHeader>
            <CardTitle>Storefront Content</CardTitle>
            <p className="text-sm text-muted-foreground">Shape the public home page without changing code. Leave a field blank to use the storefront default.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Shop Navigation Label</Label>
                <Input value={formData.shopNavigationLabel} onChange={e => setFormData({ ...formData, shopNavigationLabel: e.target.value })} placeholder="Shop" className="rounded-none" maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label>Hero Eyebrow</Label>
                <Input value={formData.heroEyebrow} onChange={e => setFormData({ ...formData, heroEyebrow: e.target.value })} placeholder="New season / Since 2026" className="rounded-none" maxLength={60} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hero Title</Label>
              <Input value={formData.heroTitle} onChange={e => setFormData({ ...formData, heroTitle: e.target.value })} placeholder="Made to be lived in." className="rounded-none" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Hero Description</Label>
              <Textarea value={formData.heroSubtitle} onChange={e => setFormData({ ...formData, heroSubtitle: e.target.value })} placeholder="A short, compelling introduction to your collection." className="rounded-none min-h-24" maxLength={280} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hero Call-to-Action</Label>
                <Input value={formData.heroCtaLabel} onChange={e => setFormData({ ...formData, heroCtaLabel: e.target.value })} placeholder="Shop the collection" className="rounded-none" maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label>Hero Image URL</Label>
                <Input value={formData.heroImageUrl} onChange={e => setFormData({ ...formData, heroImageUrl: e.target.value })} placeholder="https://..." className="rounded-none" type="url" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none shadow-sm">
          <CardHeader>
            <CardTitle>Merchandising</CardTitle>
            <p className="text-sm text-muted-foreground">Control the featured-product moment at the top of your storefront.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Featured Section Title</Label>
                <Input value={formData.featuredSectionTitle} onChange={e => setFormData({ ...formData, featuredSectionTitle: e.target.value })} placeholder="Featured arrivals" className="rounded-none" maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>Featured Product Count</Label>
                <Input type="number" min={1} max={12} value={formData.featuredProductLimit} onChange={e => setFormData({ ...formData, featuredProductLimit: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })} className="rounded-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Featured Section Description</Label>
              <Textarea value={formData.featuredSectionDescription} onChange={e => setFormData({ ...formData, featuredSectionDescription: e.target.value })} placeholder="Optional supporting copy for the featured collection." className="rounded-none min-h-20" maxLength={220} />
            </div>
          </CardContent>
        </Card>

        {!isEditing ? (
          <Card className="rounded-none shadow-sm">
            <CardHeader><CardTitle>Discovery Tiles</CardTitle></CardHeader>
            <CardContent><p className="rounded-none border border-dashed p-4 text-sm text-muted-foreground">Create this store first, then add categories and choose the discovery tiles for its home page.</p></CardContent>
          </Card>
        ) : (
          <DiscoveryTileEditor
            tiles={formData.discoveryTiles}
            categories={categories}
            categoriesLoading={categoriesLoading}
            onChange={(discoveryTiles) => setFormData((current) => ({ ...current, discoveryTiles }))}
          />
        )}

        <Card className="rounded-none shadow-sm">
          <CardHeader>
            <CardTitle>Brand Theming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary Color (Hex)</Label>
                <div className="flex gap-2">
                  <Input type="color" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="w-12 p-1 h-10 rounded-none cursor-pointer" />
                  <Input value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} className="rounded-none font-mono flex-1 uppercase" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent Color (Hex)</Label>
                <div className="flex gap-2">
                  <Input type="color" value={formData.accentColor} onChange={e => setFormData({ ...formData, accentColor: e.target.value })} className="w-12 p-1 h-10 rounded-none cursor-pointer" />
                  <Input value={formData.accentColor} onChange={e => setFormData({ ...formData, accentColor: e.target.value })} className="rounded-none font-mono flex-1 uppercase" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Typography Paradigm</Label>
              <Select value={formData.fontFamily} onValueChange={(val: any) => setFormData({ ...formData, fontFamily: val })}>
                <SelectTrigger className="rounded-none w-full md:w-[300px]">
                  <SelectValue placeholder="Select a font family" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={StoreInputFontFamily.Inter}>Inter (Clean, Modern)</SelectItem>
                  <SelectItem value={StoreInputFontFamily.Playfair_Display}>Playfair Display (Luxury, Serif)</SelectItem>
                  <SelectItem value={StoreInputFontFamily.Outfit}>Outfit (Geometric, Tech)</SelectItem>
                  <SelectItem value={StoreInputFontFamily.Space_Grotesk}>Space Grotesk (Avant-garde)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Button Treatment</Label>
              <Select value={formData.buttonStyle} onValueChange={(val: StoreInputButtonStyle | StoreUpdateButtonStyle) => setFormData({ ...formData, buttonStyle: val })}>
                <SelectTrigger className="rounded-none w-full md:w-[300px]">
                  <SelectValue placeholder="Select a button treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={StoreInputButtonStyle.square}>Square & Editorial</SelectItem>
                  <SelectItem value={StoreInputButtonStyle.rounded}>Softly Rounded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          {saveError && <p role="alert" className="mr-auto self-center text-sm text-destructive">{saveError}</p>}
          <Button type="button" variant="outline" onClick={() => setLocation('/super-admin/stores')} className="rounded-none">Cancel</Button>
          <Button type="submit" disabled={createStore.isPending || updateStore.isPending} className="rounded-none min-w-[120px]">
            {(createStore.isPending || updateStore.isPending) ? 'Saving...' : (isEditing ? 'Commit Changes' : 'Deploy Store')}
          </Button>
        </div>
      </form>
    </div>
  );
}
