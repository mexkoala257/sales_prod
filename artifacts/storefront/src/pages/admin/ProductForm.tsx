import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useCreateProduct, useUpdateProduct, useGetAdminProduct, ProductInputStatus, ProductInputChannel } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getListAdminProductsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminProductForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetAdminProduct(id || '', { query: { enabled: isEditing } });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    compareAtPrice: 0,
    status: ProductInputStatus.active,
    channel: ProductInputChannel.all,
    preOrder: false,
    preOrderNotice: '',
    variants: [{ sku: 'SKU-001', inventory: 10, price: 0, color: '', size: '' }],
    images: [{ url: 'https://via.placeholder.com/400x500?text=Product+Image', displayOrder: 1 }]
  });

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
          id: id, url: img.url, displayOrder: img.displayOrder
        })) : [{ url: 'https://via.placeholder.com/400x500?text=Product+Image', displayOrder: 1 }]
      });
    }
  }, [product, isEditing]);

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
          <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="rounded-none min-w-[120px]">
            {(createProduct.isPending || updateProduct.isPending) ? 'Saving...' : 'Commit Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
