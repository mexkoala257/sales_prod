import { useListStores, useDeleteStore, getListStoresQueryKey } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Badge } from '@/components/ui';
import { Link } from 'wouter';
import { Plus, Edit, ExternalLink, Trash2, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

export default function SuperAdminStores() {
  const { data: stores, isLoading } = useListStores();
  const deleteStore = useDeleteStore();
  const queryClient = useQueryClient();

  const handleDelete = (id: string) => {
    if (confirm('Are you absolutely sure you want to delete this store? This cannot be undone.')) {
      deleteStore.mutate({ storeId: id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() })
      });
    }
  };

  if (isLoading) return <div className="animate-pulse font-mono">Loading storefronts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Storefronts</h1>
          <p className="text-muted-foreground mt-1">Manage all tenant properties and operator accounts.</p>
        </div>
        <Link href="/super-admin/stores/new" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-none">
          <Plus className="w-4 h-4 mr-2" />
          Deploy New Store
        </Link>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores?.map((store) => (
              <TableRow key={store.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{store.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">/{store.slug}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={store.isActive ? 'default' : 'secondary'} className="rounded-none font-mono uppercase text-[10px]">
                    {store.isActive ? 'Active' : 'Offline'}
                  </Badge>
                  {store.demoMode && <Badge variant="outline" className="ml-2 rounded-none font-mono uppercase text-[10px] border-amber-500 text-amber-600">Demo</Badge>}
                </TableCell>
                <TableCell className="text-right font-mono">{store.productCount}</TableCell>
                <TableCell className="text-right font-mono">{store.orderCount}</TableCell>
                <TableCell className="text-right font-mono">${store.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {format(new Date(store.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/store/${store.slug}`} target="_blank" className="text-muted-foreground hover:text-foreground" title="View storefront">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <Link href={`/super-admin/stores/${store.id}/admins`} className="text-muted-foreground hover:text-foreground" title="Manage admins">
                      <Users className="w-4 h-4" />
                    </Link>
                    <Link href={`/super-admin/stores/${store.id}`} className="text-muted-foreground hover:text-foreground" title="Edit store">
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button onClick={() => handleDelete(store.id.toString())} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete store">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {stores?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No storefronts configured. Deploy your first store to begin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
