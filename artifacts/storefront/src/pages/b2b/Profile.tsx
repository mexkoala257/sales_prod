import { useGetB2BProfile } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Label, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function B2BProfile() {
  const { data: profile, isLoading } = useGetB2BProfile();
  const { user } = useAuth();

  if (isLoading) return <div className="animate-pulse">Loading profile...</div>;
  if (!profile) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-serif tracking-tight">Account Profile</h1>
        <p className="text-muted-foreground mt-1">Your registered procurement details.</p>
      </div>

      <div className="grid gap-6">
        <Card className="rounded-none shadow-sm border-zinc-200">
          <CardHeader className="bg-zinc-50 border-b pb-4">
            <CardTitle className="text-lg">Organization</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Company Name</Label>
                <div className="font-medium text-lg">{profile.companyName}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tenant Affiliation</Label>
                <div className="font-mono text-sm bg-zinc-100 p-2 inline-block border">{profile.storeName}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 border-t pt-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Primary Contact</Label>
                <div className="font-medium">{profile.contactName || '-'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
                <div className="font-mono text-sm">{profile.email}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none shadow-sm border-zinc-200">
          <CardHeader className="bg-zinc-50 border-b pb-4">
            <CardTitle className="text-lg">Commercial Terms</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Approved Discount</Label>
                <div className="font-mono text-3xl font-bold text-emerald-600">{profile.discountPercent}% OFF</div>
                <p className="text-xs text-muted-foreground mt-1">Applied automatically to MSRP on catalog items.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Payment Terms</Label>
                <div className="font-mono text-lg uppercase bg-zinc-900 text-white inline-block px-3 py-1 mt-1">
                  {profile.paymentTerms}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
