import { useState } from 'react';
import { useParams, Link } from 'wouter';
import {
  useGetStore,
  useListStoreAdmins,
  useCreateStoreAdmin,
  useDeleteStoreAdmin,
  getListStoreAdminsQueryKey,
} from '@workspace/api-client-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Badge,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, UserCog } from 'lucide-react';
import { format } from 'date-fns';

export default function StoreAdmins() {
  const { id: storeId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: store } = useGetStore(storeId!);
  const { data: admins, isLoading } = useListStoreAdmins(storeId!);
  const createAdmin = useCreateStoreAdmin();
  const deleteAdmin = useDeleteStoreAdmin();

  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (form.password !== form.confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    createAdmin.mutate(
      { storeId: storeId!, data: { email: form.email, password: form.password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStoreAdminsQueryKey(storeId!) });
          toast({ title: 'Admin added', description: `${form.email} can now log in as store admin.` });
          setForm({ email: '', password: '', confirm: '' });
          setShowForm(false);
        },
        onError: (err: unknown) => {
          setFormError((err as Error).message || 'Failed to create admin.');
        },
      },
    );
  };

  const handleDelete = (adminId: string, email: string) => {
    if (!confirm(`Remove ${email} as store admin? They will lose access immediately.`)) return;
    deleteAdmin.mutate(
      { storeId: storeId!, adminId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStoreAdminsQueryKey(storeId!) });
          toast({ title: 'Admin removed', description: `${email} has been removed.` });
        },
        onError: (err: unknown) => {
          toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/super-admin/stores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Storefronts
        </Link>
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Store Admins</h1>
            <p className="text-muted-foreground mt-0.5">
              {store ? (
                <>Operator accounts for <span className="font-medium text-foreground">{store.name}</span></>
              ) : 'Manage operator accounts for this storefront.'}
            </p>
          </div>
        </div>
      </div>

      {/* Current admins */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Admin Accounts</CardTitle>
            <CardDescription>These users can log in at <span className="font-mono">/admin/login</span> and manage this store.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setShowForm((v) => !v); setFormError(''); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Admin
          </Button>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t pt-4">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="admin@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={createAdmin.isPending}>
                  {createAdmin.isPending ? 'Creating…' : 'Create Admin'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setFormError(''); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent className={showForm ? 'border-t pt-4 px-0' : 'px-0 pt-0'}>
          {isLoading ? (
            <p className="px-6 py-4 text-sm text-muted-foreground animate-pulse">Loading admins…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins?.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.isActive ? 'default' : 'secondary'}
                        className="rounded-none font-mono uppercase text-[10px]"
                      >
                        {admin.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {format(new Date(admin.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => handleDelete(String(admin.id), admin.email)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove admin"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {admins?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No admin accounts yet. Add one above to grant store access.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hint */}
      <p className="text-xs text-muted-foreground">
        Admins log in at <span className="font-mono">/admin/login</span> using their email and the password set here.
        They will manage products, orders, categories, and B2B accounts for <span className="font-medium">{store?.name ?? 'this store'}</span>.
      </p>
    </div>
  );
}
