import { useGetSuperAdminAnalytics } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { Activity, DollarSign, ShoppingCart, Store, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function SuperAdminDashboard() {
  const { data, isLoading } = useGetSuperAdminAnalytics();

  if (isLoading) return <div className="p-8 font-mono animate-pulse">Loading platform metrics...</div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time aggregate performance across all storefronts.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-none border-t-4 border-t-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        
        <Card className="rounded-none border-t-4 border-t-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{data.totalOrders.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-t-4 border-t-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">B2B vs B2C Rev</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tighter text-blue-600">${data.b2bRevenue.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground font-mono">B2B</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold tracking-tighter text-muted-foreground">${data.b2cRevenue.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground/70 font-mono">B2C</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-t-4 border-t-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{data.storeBreakdown.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Store</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.storeBreakdown}>
                <XAxis dataKey="storeName" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: 0 }} />
                <Bar dataKey="revenue" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-none">
          <CardHeader>
            <CardTitle className="text-lg">Store Performance Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">B2B Orders</TableHead>
                  <TableHead className="text-right">B2C Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.storeBreakdown.map(store => (
                  <TableRow key={store.storeId}>
                    <TableCell className="font-medium">{store.storeName}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{store.b2bOrders}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{store.b2cOrders}</TableCell>
                    <TableCell className="text-right font-mono">${store.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
