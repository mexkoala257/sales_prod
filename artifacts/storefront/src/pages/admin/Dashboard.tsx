import { useGetStoreDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui';
import { Package, ShoppingBag, Users, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { data, isLoading } = useGetStoreDashboard();

  if (isLoading) return <div className="animate-pulse">Loading dashboard...</div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Store Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your store's performance and recent activity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-none border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        
        <Card className="rounded-none border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders Pipeline</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tighter">{data.pendingOrders}</span>
              <span className="text-sm text-muted-foreground">pending</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.totalOrders} total orders</p>
          </CardContent>
        </Card>

        <Card className="rounded-none border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Catalog Health</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tighter">{data.activeProducts}</span>
              <span className="text-sm text-muted-foreground">active</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">of {data.totalProducts} total products</p>
          </CardContent>
        </Card>

        <Card className="rounded-none border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">B2B Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{data.b2bClients}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none shadow-sm">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentOrders?.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">#{order.id.toString().padStart(6, '0')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase ${order.type === 'b2b' ? 'border-blue-500 text-blue-600' : 'border-emerald-500 text-emerald-600'}`}>
                      {order.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.type === 'b2b' ? order.b2bCompanyName : order.customerName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-none font-mono text-[10px] uppercase">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {format(new Date(order.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
              {(!data.recentOrders || data.recentOrders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No recent orders.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
