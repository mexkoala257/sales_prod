import { useListAdminProducts, useSyncProductToShopify, useImportFromShopify, getListAdminProductsQueryKey } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '@/components/ui';
import { Link } from 'wouter';
import { Plus, Edit, RefreshCw, Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function AdminProducts() {
  const { data: products, isLoading } = useListAdminProducts();
  const syncProduct = useSyncProductToShopify();
  const importProducts = useImportFromShopify();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = (productId: string) => {
    syncProduct.mutate({ productId }, {
      onSuccess: (res) => {
        toast({ title: "Sync Complete", description: res.message });
        queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Sync Failed", description: err.message || "An error occurred", variant: "destructive" });
      }
    });
  };

  const handleImport = () => {
    importProducts.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Import Complete", description: res.message });
        queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Import Failed", description: err.message || "An error occurred", variant: "destructive" });
      },
    });
  };

  if (isLoading) return <div className="animate-pulse">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Product Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage catalog variants. Shopify controls checkout stock availability.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImport} disabled={importProducts.isPending}>
            <Download className={`w-4 h-4 mr-2 ${importProducts.isPending ? 'animate-pulse' : ''}`} />
            {importProducts.isPending ? 'Importing…' : 'Import from Shopify'}
          </Button>
          <Link href="/admin/products/new" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-none">
            <Plus className="w-4 h-4 mr-2" />
            Create Product
          </Link>
        </div>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Shopify Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="font-medium">{product.name}</div>
                  {product.preOrder && <Badge variant="outline" className="rounded-none mt-1 border-amber-500 text-amber-600 text-[9px] uppercase px-1">Pre-order</Badge>}
                </TableCell>
                <TableCell className="font-mono">${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className="rounded-none font-mono text-[10px] uppercase">
                    {product.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase">
                    {product.channel}
                  </Badge>
                </TableCell>
                <TableCell>
                  {product.shopifySynced && product.shopifyProductId ? (
                     <span className="text-xs text-emerald-600 font-medium flex items-center">
                       <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Synced
                     </span>
                  ) : (
                     <span className="text-xs text-muted-foreground flex items-center">
                       <span className="w-2 h-2 rounded-full bg-zinc-300 mr-2"></span> Unlinked
                     </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleSync(product.id.toString())} title="Sync to Shopify" disabled={syncProduct.isPending}>
                      <RefreshCw className={`w-4 h-4 ${syncProduct.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href={`/admin/products/${product.id}`} className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-none">
                      <Edit className="w-4 h-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {products?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No products found. Create a product or sync from Shopify.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
