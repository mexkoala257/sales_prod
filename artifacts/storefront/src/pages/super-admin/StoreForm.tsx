import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useCreateStore, useUpdateStore, useGetStore, StoreInputFontFamily, StoreUpdateFontFamily } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { getListStoresQueryKey } from '@workspace/api-client-react';
import { Globe } from 'lucide-react';

export default function SuperAdminStoreForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: store, isLoading } = useGetStore(id || '', { query: { enabled: isEditing } as any });
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    customDomain: '',
    primaryColor: '#000000',
    accentColor: '#f3f4f6',
    fontFamily: StoreInputFontFamily.Inter as StoreInputFontFamily | StoreUpdateFontFamily,
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
        demoMode: store.demoMode,
        isActive: store.isActive,
      });
    }
  }, [store, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Normalise: strip https://, trailing slashes, lowercase, strip www. prefix
    // so the DB always stores the bare apex domain (e.g. "apexathletics.com")
    const rawDomain = formData.customDomain.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')   // strip any path
      .toLowerCase()
      .replace(/^www\./, ''); // strip www. prefix

    // Send null when the domain is cleared so the unique constraint isn't violated
    const domain: string | null = rawDomain || null;

    if (isEditing) {
      updateStore.mutate(
        { storeId: id, data: { ...formData, customDomain: domain } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
            setLocation('/super-admin/stores');
          },
        },
      );
    } else {
      createStore.mutate(
        { data: { ...formData, customDomain: domain } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
            setLocation('/super-admin/stores');
          },
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
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => setLocation('/super-admin/stores')} className="rounded-none">Cancel</Button>
          <Button type="submit" disabled={createStore.isPending || updateStore.isPending} className="rounded-none min-w-[120px]">
            {(createStore.isPending || updateStore.isPending) ? 'Saving...' : (isEditing ? 'Commit Changes' : 'Deploy Store')}
          </Button>
        </div>
      </form>
    </div>
  );
}
