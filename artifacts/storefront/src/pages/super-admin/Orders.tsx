import { useListAllOrders } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui';
import { format } from 'date-fns';

export default function SuperAdminOrders() {
  const { data: orders, isLoading } = useListAllOrders();

  if (isLoading) return <div className="animate-pulse font-mono">Querying global order stream...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Global Order Stream</h1>
        <p className="text-muted-foreground mt-1">Unified view of all transactions across the platform.</p>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">#{order.id.toString().padStart(6, '0')}</TableCell>
                <TableCell className="font-medium">{order.storeName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase ${order.type === 'b2b' ? 'border-blue-500 text-blue-600' : 'border-emerald-500 text-emerald-600'}`}>
                    {order.type}
                  </Badge>
                </TableCell>
                <TableCell>{order.type === 'b2b' ? order.b2bCompanyName : order.customerName}</TableCell>
                <TableCell className="text-right font-mono">${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="rounded-none font-mono text-[10px] uppercase">
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {format(new Date(order.createdAt), 'MMM d, HH:mm')}
                </TableCell>
              </TableRow>
            ))}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No orders found in the platform.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
