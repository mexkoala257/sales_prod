import { Switch, Route, Redirect } from 'wouter';
import { SuperAdminLayout, AdminLayout, B2BLayout } from './components/layouts';

// Super Admin
import SuperAdminLogin from './pages/super-admin/Login';
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import SuperAdminStores from './pages/super-admin/Stores';
import SuperAdminStoreForm from './pages/super-admin/StoreForm';
import SuperAdminOrders from './pages/super-admin/Orders';
import SuperAdminSettings from './pages/super-admin/Settings';

// Store Admin
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminProductForm from './pages/admin/ProductForm';
import AdminCategories from './pages/admin/Categories';
import AdminB2BAccounts from './pages/admin/B2BAccounts';
import AdminB2BForm from './pages/admin/B2BForm';
import AdminOrders from './pages/admin/Orders';

// B2B
import B2BLogin from './pages/b2b/Login';
import B2BForcePassword from './pages/b2b/ForcePassword';
import B2BCatalog from './pages/b2b/Catalog';
import B2BMatrix from './pages/b2b/Matrix';
import B2BArtwork from './pages/b2b/Artwork';
import B2BOrders from './pages/b2b/Orders';
import B2BProfile from './pages/b2b/Profile';

// Storefront
import StorefrontList from './pages/storefront/List';
import StorefrontHome from './pages/storefront/Home';
import StorefrontProducts from './pages/storefront/Products';
import StorefrontProductDetail from './pages/storefront/ProductDetail';
import StorefrontCart from './pages/storefront/Cart';

export function AppRoutes() {
  return (
    <Switch>
      {/* Super Admin */}
      <Route path="/super-admin/login" component={SuperAdminLogin} />
      <Route path="/super-admin/dashboard"><SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout></Route>
      <Route path="/super-admin/stores"><SuperAdminLayout><SuperAdminStores /></SuperAdminLayout></Route>
      <Route path="/super-admin/stores/new"><SuperAdminLayout><SuperAdminStoreForm /></SuperAdminLayout></Route>
      <Route path="/super-admin/stores/:id"><SuperAdminLayout><SuperAdminStoreForm /></SuperAdminLayout></Route>
      <Route path="/super-admin/orders"><SuperAdminLayout><SuperAdminOrders /></SuperAdminLayout></Route>
      <Route path="/super-admin/settings"><SuperAdminLayout><SuperAdminSettings /></SuperAdminLayout></Route>

      {/* Store Admin */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard"><AdminLayout><AdminDashboard /></AdminLayout></Route>
      <Route path="/admin/products"><AdminLayout><AdminProducts /></AdminLayout></Route>
      <Route path="/admin/products/new"><AdminLayout><AdminProductForm /></AdminLayout></Route>
      <Route path="/admin/products/:id"><AdminLayout><AdminProductForm /></AdminLayout></Route>
      <Route path="/admin/categories"><AdminLayout><AdminCategories /></AdminLayout></Route>
      <Route path="/admin/b2b-accounts"><AdminLayout><AdminB2BAccounts /></AdminLayout></Route>
      <Route path="/admin/b2b-accounts/new"><AdminLayout><AdminB2BForm /></AdminLayout></Route>
      <Route path="/admin/b2b-accounts/:id"><AdminLayout><AdminB2BForm /></AdminLayout></Route>
      <Route path="/admin/orders"><AdminLayout><AdminOrders /></AdminLayout></Route>

      {/* B2B */}
      <Route path="/b2b/login" component={B2BLogin} />
      <Route path="/b2b/force-password-change"><B2BForcePassword /></Route>
      <Route path="/b2b/catalog"><B2BLayout><B2BCatalog /></B2BLayout></Route>
      <Route path="/b2b/matrix"><B2BLayout><B2BMatrix /></B2BLayout></Route>
      <Route path="/b2b/artwork"><B2BLayout><B2BArtwork /></B2BLayout></Route>
      <Route path="/b2b/orders"><B2BLayout><B2BOrders /></B2BLayout></Route>
      <Route path="/b2b/profile"><B2BLayout><B2BProfile /></B2BLayout></Route>

      {/* Public Storefront */}
      <Route path="/" component={StorefrontList} />
      <Route path="/store/:storeSlug" component={StorefrontHome} />
      <Route path="/store/:storeSlug/products" component={StorefrontProducts} />
      <Route path="/store/:storeSlug/products/:productId" component={StorefrontProductDetail} />
      <Route path="/store/:storeSlug/cart" component={StorefrontCart} />

      {/* 404 */}
      <Route>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-muted-foreground mb-4">Page not found</p>
            <a href="/" className="text-primary underline">Go Home</a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}
