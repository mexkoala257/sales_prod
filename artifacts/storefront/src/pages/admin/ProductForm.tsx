import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { useCreateProduct, useUpdateProduct, useGetAdminProduct, ProductInputStatus, ProductInputChannel, customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getListAdminProductsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminProductForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product, isLoading } = useGetAdminProduct(id || '', { query: { enabled: isEditing } as any });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [formData, setFormData] = useState<{
    name: string; description: string; price: number; compareAtPrice: number;
    status: ProductInputStatus; channel: ProductInputChannel;
    preOrder: boolean; preOrderNotice: string;
    variants: Array<{ id?: number; sku: string; inventory: number; price: number; color: string; size: string }>;
    images: Array<{ id?: number; url: string; altText?: string; displayOrder: number }>;
  }>({
    name: '',
    description: '',
    price: 0,
    compareAtPrice: 0,
    status: ProductInputStatus.active,
    channel: ProductInputChannel.all,
    preOrder: false,
    preOrderNotice: '',
    variants: [{ sku: 'SKU-001', inventory: 10, price: 0, color: '', size: '' }],
    images: []
  });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product && isEditing) {
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        compareAtPrice: product.compareAtPrice || 0,
        status: product.status as ProductInputStatus,
        channel: product.channel as ProductInputChannel,
        preOrder: product.preOrder,
        preOrderNotice: product.preOrderNotice || '',
        variants: product.variants?.length ? product.variants.map(v => ({
          id: v.id, sku: v.sku, inventory: v.inventory, price: v.price || 0, color: v.color || '', size: v.size || ''
        })) : [{ sku: 'SKU-001', inventory: 10, price: 0, color: '', size: '' }],
        images: product.images?.length ? product.images.map(img => ({
          id: img.id, url: img.url, altText: img.altText || '', displayOrder: img.displayOrder
        })) : []
      });
    }
  }, [product, isEditing]);

  const uploadProductImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingImages(true);
    setUploadError(null);
    try {
      const uploaded: Array<{ url: string; altText: string; displayOrder: number }> = [];
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
          throw new Error(`${file.name} is not a supported image type.`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than 10 MB.`);
        }
        const request = await customFetch<{ uploadURL: string; objectPath: string }>('/api/storage/product-images/request-url', {
          method: 'POST',
          body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }),
        });
        const { uploadURL, objectPath } = request;
        const upload = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!upload.ok) throw new Error(`Could not upload ${file.name}.`);
        const finalize = await customFetch<{ publicUrl: string }>('/api/storage/product-images/finalize', {
          method: 'POST',
          body: JSON.stringify({ objectPath }),
        });
        const { publicUrl } = finalize;
        uploaded.push({ url: publicUrl, altText: file.name.replace(/\.[^/.]+$/, ''), displayOrder: 0 });
      }
      setFormData((current) => ({
        ...current,
        images: [
          ...current.images,
          ...uploaded.map((image, index) => ({ ...image, displayOrder: current.images.length + index + 1 })),
        ],
      }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      variants: formData.variants.map(v => ({...v, price: v.price || undefined}))
    };
    
    if (isEditing) {
      updateProduct.mutate({ productId: id, data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
          setLocation('/admin/products');
        }
      });
    } else {
      createProduct.mutate({ data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
          setLocation('/admin/products');
        }
      });
    }
  };

  if (isEditing && isLoading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{isEditing ? 'Edit Product' : 'Create Product'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-none h-32" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} required className="rounded-none font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Compare At Price ($)</Label>
                <Input type="number" step="0.01" value={formData.compareAtPrice} onChange={e => setFormData({...formData, compareAtPrice: parseFloat(e.target.value)})} className="rounded-none font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload JPEG, PNG, WebP, or GIF files up to 10 MB. Uploaded images are public so Shopify can import them during sync.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => uploadProductImages(event.target.files)}
            />
            <Button type="button" variant="outline" className="rounded-none" disabled={uploadingImages}
              onClick={() => imageInputRef.current?.click()}>
              {uploadingImages ? 'Uploading images…' : 'Upload images'}
            </Button>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            {formData.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {formData.images.map((image, index) => (
                  <div key={`${image.id ?? image.url}-${index}`} className="space-y-2">
                    <img src={image.url} alt={image.altText || formData.name || 'Product image'} className="w-full aspect-square object-cover border" />
                    <Input value={image.altText || ''} placeholder="Alt text"
                      onChange={(event) => {
                        const images = [...formData.images];
                        images[index] = { ...images[index], altText: event.target.value };
                        setFormData({ ...formData, images });
                      }} className="rounded-none text-sm" />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-none flex-1" disabled={index === 0}
                        onClick={() => {
                          const images = [...formData.images];
                          [images[index - 1], images[index]] = [images[index], images[index - 1]];
                          setFormData({ ...formData, images: images.map((item, position) => ({ ...item, displayOrder: position + 1 })) });
                        }}>Move up</Button>
                      <Button type="button" variant="destructive" size="sm" className="rounded-none flex-1"
                        onClick={() => setFormData({ ...formData, images: formData.images.filter((_, position) => position !== index) })}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No images uploaded yet.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Distribution Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ProductInputStatus.active}>Active</SelectItem>
                    <SelectItem value={ProductInputStatus.disabled}>Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visibility Channel</Label>
                <Select value={formData.channel} onValueChange={(val: any) => setFormData({...formData, channel: val})}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ProductInputChannel.all}>All (B2B & B2C)</SelectItem>
                    <SelectItem value={ProductInputChannel.b2b}>B2B Wholesale Only</SelectItem>
                    <SelectItem value={ProductInputChannel.b2c}>B2C Retail Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-4 border-t mt-4">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.preOrder} onChange={e => setFormData({...formData, preOrder: e.target.checked})} className="rounded-none border-input" />
                <span className="text-sm font-medium">Enable Pre-order</span>
              </label>
            </div>
            {formData.preOrder && (
              <div className="space-y-2">
                <Label>Pre-order Notice (e.g. Ships in 4 weeks)</Label>
                <Input value={formData.preOrderNotice} onChange={e => setFormData({...formData, preOrderNotice: e.target.value})} className="rounded-none" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Variant & Inventory Matrix</CardTitle>
            <p className="text-sm text-muted-foreground">
              Inventory is catalog data. Update stock in Shopify to control checkout availability.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.variants.map((v, i) => (
              <div key={i} className="flex gap-2 items-end border-b pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
                <div className="space-y-2 flex-1">
                  <Label>SKU</Label>
                  <Input value={v.sku} onChange={e => { const nv = [...formData.variants]; nv[i].sku = e.target.value; setFormData({...formData, variants: nv}) }} className="rounded-none font-mono text-sm" />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Color</Label>
                  <Input value={v.color} onChange={e => { const nv = [...formData.variants]; nv[i].color = e.target.value; setFormData({...formData, variants: nv}) }} className="rounded-none" placeholder="e.g. Black" />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Size</Label>
                  <Input value={v.size} onChange={e => { const nv = [...formData.variants]; nv[i].size = e.target.value; setFormData({...formData, variants: nv}) }} className="rounded-none" placeholder="e.g. L" />
                </div>
                <div className="space-y-2 w-24">
                  <Label>Inv</Label>
                  <Input type="number" value={v.inventory} onChange={e => { const nv = [...formData.variants]; nv[i].inventory = parseInt(e.target.value); setFormData({...formData, variants: nv}) }} className="rounded-none font-mono" />
                </div>
                {i > 0 && (
                  <Button type="button" variant="destructive" className="rounded-none px-3" onClick={() => {
                    const nv = [...formData.variants]; nv.splice(i, 1); setFormData({...formData, variants: nv});
                  }}>Remove</Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" className="rounded-none w-full" onClick={() => {
              setFormData({...formData, variants: [...formData.variants, { sku: `SKU-NEW`, inventory: 0, price: 0, color: '', size: '' }]})
            }}>+ Add Variant</Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pb-12">
          <Button type="button" variant="outline" onClick={() => setLocation('/admin/products')} className="rounded-none">Cancel</Button>
          <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending || uploadingImages} className="rounded-none min-w-[120px]">
            {(createProduct.isPending || updateProduct.isPending) ? 'Saving...' : 'Commit Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
