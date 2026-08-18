import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useCreateB2BClient, useUpdateB2BClient, useGetB2BClient, B2BClientInputPaymentTerms, B2BClientUpdatePaymentTerms } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { getListB2BClientsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminB2BForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client, isLoading } = useGetB2BClient(id || '', { query: { enabled: isEditing } as any });
  const createClient = useCreateB2BClient();
  const updateClient = useUpdateB2BClient();

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
    }
  }, [client, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      const payload = {
        companyName: formData.companyName,
        contactName: formData.contactName,
        phone: formData.phone,
        discountPercent: formData.discountPercent,
        paymentTerms: formData.paymentTerms as B2BClientUpdatePaymentTerms,
        isActive: formData.isActive
      };
      updateClient.mutate({ clientId: id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListB2BClientsQueryKey() });
          setLocation('/admin/b2b-accounts');
        }
      });
    } else {
      createClient.mutate({ data: formData as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListB2BClientsQueryKey() });
          setLocation('/admin/b2b-accounts');
        }
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

        <div className="flex justify-end gap-4 pb-12">
          <Button type="button" variant="outline" onClick={() => setLocation('/admin/b2b-accounts')} className="rounded-none">Cancel</Button>
          <Button type="submit" disabled={createClient.isPending || updateClient.isPending} className="rounded-none min-w-[120px]">
            {(createClient.isPending || updateClient.isPending) ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
