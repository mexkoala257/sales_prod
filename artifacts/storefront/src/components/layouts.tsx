import { useAuth } from '@/context/AuthContext';
import { Redirect, Route, useLocation } from 'wouter';
import { Button } from '@/components/ui';
import { LayoutDashboard, Store, ShoppingBag, Settings, LogOut, Package, Users, Palette, Image } from 'lucide-react';
import { Link } from 'wouter';
import React from 'react';

function TopNav({ title, role }: { title: string, role: string }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    if (role === 'super_admin') setLocation('/super-admin/login');
    else if (role === 'store_admin') setLocation('/admin/login');
    else setLocation('/b2b/login');
  };

  return (
    <div className="h-14 border-b bg-background flex items-center justify-between px-6 shrink-0">
      <div className="font-semibold text-lg tracking-tight">{title}</div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}

function SidebarItem({ href, icon: Icon, label }: { href: string, icon: any, label: string }) {
  const [location] = useLocation();
  const active = location.startsWith(href) && (href !== '/' || location === '/');

  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'super_admin') return <Redirect to="/super-admin/login" />;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div className="w-64 border-r bg-sidebar shrink-0 flex flex-col">
        <div className="h-14 border-b flex items-center px-6 font-bold tracking-widest uppercase text-xs">
          COMMAND CENTER
        </div>
        <nav className="flex-1 py-4 space-y-1">
          <SidebarItem href="/super-admin/dashboard" icon={LayoutDashboard} label="Platform Dashboard" />
          <SidebarItem href="/super-admin/stores" icon={Store} label="Storefronts" />
          <SidebarItem href="/super-admin/orders" icon={ShoppingBag} label="Global Orders" />
          <SidebarItem href="/super-admin/settings" icon={Settings} label="Settings" />
        </nav>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Super Admin Portal" role="super_admin" />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'store_admin') return <Redirect to="/admin/login" />;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div className="w-64 border-r bg-sidebar shrink-0 flex flex-col">
        <div className="h-14 border-b flex items-center px-6 font-bold tracking-widest uppercase text-xs truncate">
          {user.storeName || 'Store Admin'}
        </div>
        <nav className="flex-1 py-4 space-y-1">
          <SidebarItem href="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem href="/admin/products" icon={Package} label="Products" />
          <SidebarItem href="/admin/categories" icon={Settings} label="Categories" />
          <SidebarItem href="/admin/orders" icon={ShoppingBag} label="Orders" />
          <SidebarItem href="/admin/b2b-accounts" icon={Users} label="B2B Clients" />
        </nav>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Store Management" role="store_admin" />
        <main className="flex-1 overflow-auto p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}

export function B2BLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  if (!user || user.role !== 'b2b_client') return <Redirect to="/b2b/login" />;

  if (user.forcePasswordChange && location !== '/b2b/force-password-change') {
    return <Redirect to="/b2b/force-password-change" />;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div className="w-64 border-r bg-sidebar shrink-0 flex flex-col">
        <div className="h-14 border-b flex items-center px-6 font-bold tracking-widest uppercase text-xs truncate">
          {user.companyName || 'B2B Portal'}
        </div>
        <nav className="flex-1 py-4 space-y-1">
          <SidebarItem href="/b2b/catalog" icon={Package} label="Catalog" />
          <SidebarItem href="/b2b/matrix" icon={LayoutDashboard} label="Batch Order Matrix" />
          <SidebarItem href="/b2b/orders" icon={ShoppingBag} label="My Orders" />
          <SidebarItem href="/b2b/artwork" icon={Image} label="Artwork Library" />
          <SidebarItem href="/b2b/profile" icon={Settings} label="Account Profile" />
        </nav>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Wholesale Procurement" role="b2b_client" />
        <main className="flex-1 overflow-auto p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}
