import { useListAdminCategories } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button } from '@/components/ui';

export default function AdminCategories() {
  const { data: categories, isLoading } = useListAdminCategories();

  if (isLoading) return <div className="animate-pulse">Loading categories...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Taxonomy</h1>
          <p className="text-muted-foreground mt-1">Manage catalog categorization tree.</p>
        </div>
        <Button className="rounded-none">Add Category</Button>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Category Name</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-mono text-muted-foreground">{cat.displayOrder}</TableCell>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-right font-mono">{cat.productCount}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="rounded-none">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
            {categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No categories defined.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
