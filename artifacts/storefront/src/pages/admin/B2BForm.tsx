import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  useCreateB2BClient, useUpdateB2BClient, useGetB2BClient, useListAdminProducts, useSetB2BClientProducts,
  B2BClientInputPaymentTerms, B2BClientUpdatePaymentTerms,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { getListB2BClientsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function AdminB2BForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client, isLoading } = useGetB2BClient(id || '', { query: { enabled: isEditing } as any });
  const { data: products, isLoading: productsLoading } = useListAdminProducts();
  const createClient = useCreateB2BClient();
  const updateClient = useUpdateB2BClient();
  const setProductAccess = useSetB2BClientProducts();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    contactName: '',
    phone: '',
    discountPercent: 0,
    paymentTerms: B2BClientInputPaymentTerms.net30 as B2BClientInputPaymentTerms | B2BClientUpdatePaymentTerms,
    isActive: true
  });
  const [assignedProductIds, setAssignedProductIds] = useState<number[]>([]);
  const [defaultAccessInitialized, setDefaultAccessInitialized] = useState(false);

  const availableProducts = (products ?? []).filter(
    (product) => product.status === 'active' && (product.channel === 'all' || product.channel === 'b2b')
  );

  useEffect(() => {
    if (client && isEditing) {
      setFormData({
        email: client.email,
        password: '',
        companyName: client.companyName,
        contactName: client.contactName || '',
        phone: client.phone || '',
        discountPercent: client.discountPercent,
        paymentTerms: client.paymentTerms as B2BClientInputPaymentTerms,
        isActive: client.isActive
      });
      setAssignedProductIds(client.assignedProductIds ?? []);
    }
  }, [client, isEditing]);

  useEffect(() => {
    if (!isEditing && !defaultAccessInitialized && !productsLoading) {
      setAssignedProductIds(availableProducts.map((product) => product.id));
      setDefaultAccessInitialized(true);
    }
  }, [availableProducts, defaultAccessInitialized, isEditing, productsLoading]);

  const toggleProduct = (productId: number) => {
    setAssignedProductIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const payload = {
          companyName: formData.companyName,
          contactName: formData.contactName,
          phone: formData.phone,
          discountPercent: formData.discountPercent,
          paymentTerms: formData.paymentTerms as B2BClientUpdatePaymentTerms,
          isActive: formData.isActive
        };
        await updateClient.mutateAsync({ clientId: id, data: payload });
        await setProductAccess.mutateAsync({ clientId: id, data: { productIds: assignedProductIds } });
      } else {
        const created = await createClient.mutateAsync({ data: formData as any });
        await setProductAccess.mutateAsync({ clientId: String(created.id), data: { productIds: assignedProductIds } });
      }

      queryClient.invalidateQueries({ queryKey: getListB2BClientsQueryKey() });
      toast({
        title: isEditing ? 'Partner updated' : 'Partner onboarded',
        description: `${assignedProductIds.length} product${assignedProductIds.length === 1 ? '' : 's'} available in this partner's catalog.`,
      });
      setLocation('/admin/b2b-accounts');
    } catch {
      toast({
        title: 'Could not save partner access',
        description: 'No changes were confirmed. Please check the details and try again.',
        variant: 'destructive',
      });
    }
  };

  if (isEditing && isLoading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{isEditing ? 'Edit Partner Profile' : 'Onboard Partner'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} required className="rounded-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Contact</Label>
                <Input value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="rounded-none font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Portal Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Login Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required disabled={isEditing} className="rounded-none" />
            </div>
            {!isEditing && (
              <div className="space-y-2">
                <Label>Initial Password (Must be changed on first login)</Label>
                <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required className="rounded-none" />
              </div>
            )}
            {isEditing && (
              <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded-none border-input" />
                <span className="text-sm font-medium">Account Active</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Commercial Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform Discount (%)</Label>
                <Input type="number" min="0" max="100" value={formData.discountPercent} onChange={e => setFormData({...formData, discountPercent: parseInt(e.target.value)})} required className="rounded-none font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={formData.paymentTerms} onValueChange={(val: any) => setFormData({...formData, paymentTerms: val})}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={B2BClientInputPaymentTerms.net30}>Net 30 Days</SelectItem>
                    <SelectItem value={B2BClientInputPaymentTerms.cod}>Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Approved Catalog</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which active products this partner can order. New partners start with every eligible product selected.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <p className="text-sm font-medium">
                {assignedProductIds.length} of {availableProducts.length} products assigned
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-none"
                  onClick={() => setAssignedProductIds(availableProducts.map((product) => product.id))}
                  disabled={productsLoading || availableProducts.length === 0}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-none"
                  onClick={() => setAssignedProductIds([])}
                  disabled={assignedProductIds.length === 0}>
                  Clear all
                </Button>
              </div>
            </div>

            {productsLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading available products…</p>
            ) : availableProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed p-4">
                This storefront does not have any active B2B or all-channel products yet.
              </p>
            ) : (
              <div className="max-h-72 divide-y overflow-y-auto border">
                {availableProducts.map((product) => {
                  const assigned = assignedProductIds.includes(product.id);
                  return (
                    <label key={product.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() => toggleProduct(product.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">${product.price.toFixed(2)} · {product.channel === 'all' ? 'All channels' : 'B2B only'}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pb-12">
          <Button type="button" variant="outline" onClick={() => setLocation('/admin/b2b-accounts')} className="rounded-none">Cancel</Button>
          <Button type="submit" disabled={createClient.isPending || updateClient.isPending || setProductAccess.isPending} className="rounded-none min-w-[120px]">
            {(createClient.isPending || updateClient.isPending || setProductAccess.isPending) ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
