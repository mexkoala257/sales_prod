# 🚀 Project Handoff & Technical Specification Report

**Project Name**: Multi-Brand Shopify E-Commerce & B2B Wholesale Portal Platform  
**System Architecture**: Full-Stack Monorepo (Node.js/Express + React/Vite)  
**Primary Integration**: Bi-Directional Shopify Admin & Storefront API  

---

## 1. Executive Summary & Core Requirements

This platform is a multi-tenant, multi-brand e-commerce system built to support both **Direct-to-Consumer (B2C)** storefronts and a high-volume **Business-to-Business (B2B)** wholesale ordering portal. It enables business owners to run multiple distinct retail brands from a single codebase while providing corporate clients with custom pricing, matrix batch ordering, artwork uploading for product branding, and flexible payment terms (Net-30 / Pay on Delivery).

---

## 2. Comprehensive Requirements Breakdown

### A. Master Super Admin Platform Suite (`/super-admin/*`)
- **Isolated Management**: Completely separated from public storefronts and store admin pages.
- **Storefront Provisioning**: Super Admin can create, configure, edit, or delete storefronts.
- **Theme & Design Tokens**: Customize Storefront Name, Logo Text, Logo Image URL, Announcement Bar, Primary & Accent Colors, and Typography (`Inter`, `Playfair Display`, `Outfit`, `Space Grotesk`).
- **Shopify Configuration**: Assign individual Shopify Domains, Storefront Access Tokens, Admin API Keys, and Demo/Live Mode toggles per store.
- **Admin Delegation**: Provision and delete store-level administrator accounts (`admin@store.com`), assigning each to specific storefronts.
- **Global Financial Analytics**: Aggregate sales revenue, total order volume, B2B wholesale vs B2C retail breakdown across all storefronts.
- **Multi-Store Order Tracker**: Monitor orders across all storefronts, inspect attached customer artwork, and advance order progression steps (Received -> Production -> Shipped -> Delivered).

### B. Store Administrator Suite (`/admin/*`)
- **Storefront Decoupled Navigation**: Zero public storefront header/footer links; accessed strictly via direct URL (`/admin/login`).
- **Product & Inventory Engine (`/admin/products`)**:
  - Full CRUD operations (Create, Read, Update, Delete).
  - Status Toggling (`Active` / `Disabled`): Hides disabled products from customer views.
  - Channel Visibility Control (`All Channels`, `B2B Wholesale Only`, `B2C Retail Only`).
  - Pre-Order Mode: Toggle pre-order options when stock reaches 0 with customizable delivery notices (e.g., *"Ships in 14 business days"*).
  - Shopify Sync: Automatic bi-directional sync to Shopify Admin API (`POST /admin/api/2024-01/products.json`) and 1-click catalog import button.
- **Category Taxonomy Manager (`/admin/categories`)**:
  - Create and edit top-level and subcategories.
  - Set custom display order rank (`#1`, `#2`) and category banner images.
  - Live product count tracking per category.
- **B2B User Provisioning & Product Assignment (`/admin/b2b-accounts`)**:
  - Provision wholesale client accounts with assigned discount percentages (`% OFF MSRP`) and payment terms (COD, Net-30).
  - Dictate exact product catalog access per client via interactive product checkboxes.
- **Order Fulfillment Tracker (`/admin/dashboard`)**:
  - Track orders, inspect line-item artwork placement specs, advance 4-step fulfillment status.

### C. B2B Wholesale Client Portal (`/b2b/*`)
- **Authentication & Security**: Email & Password login with mandatory password reset on initial login (`/b2b/force-password-change`).
- **Personalized Wholesale Pricing**: Assigned discount percentages applied dynamically without showing discount labels.
- **Multi-Variant Batch Ordering Matrix (`/b2b/matrix`)**:
  - Grid table allowing wholesale buyers to enter quantities across color/size variants simultaneously and add batch items to cart in 1 click.
  - Filters matrix products to only show items assigned to that client account.
- **Company Branding & Artwork Library (`B2BArtworkManager.jsx`)**:
  - B2B clients can upload company logos/artwork (PNG, SVG, JPG).
  - Uploaded artwork files are saved statically to disk (`server/uploads/art_<timestamp>.<ext>`) to avoid `localStorage` size quota errors.
  - Line-Item Artwork Selection: Clients select specific uploaded artwork from dropdown selectors on matrix product rows to dictate branding per item ordered.
- **Wholesale Checkout & Order History**:
  - Checkout via Pay on Delivery / COD / Net-30.
  - Generates local digital receipts and background Shopify Draft Orders with attached artwork metadata.
  - Live order tracking step bar (Steps 1–4).

### D. Direct-to-Consumer (B2C) Storefront
- **Dynamic Multi-Brand Rendering**: Renders active brand preset colors, logos, fonts, and announcement bars.
- **Multi-Photo Product Gallery**: Interactive photo switcher, size/color variant selector, inventory stock badges, and pre-order delivery notices.
- **Shopping Cart Drawer**: Slide-out cart with item-level artwork badges and instant checkout options.

---

## 3. Technical Architecture & File Structure

```
c:\Users\MDR\Documents\projectX\
├── server/                        # Express Node.js Backend API
│   ├── config/
│   │   └── brandDefaults.js       # Default multi-brand presets
│   ├── controllers/
│   │   ├── authController.js      # Admin & B2B login authentication
│   │   ├── b2bController.js       # B2B users, matrix, artwork uploads, orders
│   │   ├── brandController.js     # Brand configuration endpoints
│   │   ├── categoryController.js  # Category taxonomy manager
│   │   ├── orderController.js     # B2C & B2B order creation & checkout
│   │   ├── productController.js   # Product CRUD, status toggling, inventory
│   │   ├── shopifyController.js   # Shopify credentials & webhook settings
│   │   └── superAdminController.js # Super Admin multi-store platform engine
│   ├── db/
│   │   ├── data.json              # Primary Lowdb JSON database store
│   │   └── database.js            # Database wrapper & initial data seed
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT authentication (Admin, B2B, SuperAdmin)
│   ├── services/
│   │   └── shopifyService.js      # Shopify Admin & Storefront API integration
│   ├── uploads/                   # Static directory for uploaded artwork assets
│   └── index.js                   # Express server entry point (Port 5000)
│
├── src/                           # React Frontend (Vite)
│   ├── components/
│   │   ├── AdminHeader.jsx        # Navigation header for Store Admin pages
│   │   ├── B2BArtworkManager.jsx  # Company logo & artwork library tab
│   │   ├── B2BOrderHistory.jsx    # B2B client order tracking table
│   │   ├── BatchOrderMatrix.jsx   # Multi-variant wholesale matrix grid
│   │   ├── CartDrawer.jsx         # Slide-out cart drawer
│   │   ├── ErrorBoundary.jsx      # React error boundary safety fallback
│   │   ├── Footer.jsx             # Public storefront footer
│   │   ├── Header.jsx             # Public storefront header (admin links hidden)
│   │   ├── MultiPhotoGallery.jsx  # Product detail image gallery & pre-order view
│   │   ├── ProductCard.jsx        # Storefront product card component
│   │   └── SuperAdminHeader.jsx   # Navigation header for Super Admin portal
│   ├── context/
│   │   ├── AuthContext.jsx        # Admin & B2B session auth context
│   │   ├── BrandContext.jsx       # Multi-brand theme provider
│   │   └── CartContext.jsx        # Shopping cart state provider
│   ├── pages/
│   │   ├── Admin/                 # Store Admin pages (/admin/*)
│   │   ├── B2BPortal/             # B2B client pages (/b2b/*)
│   │   ├── Storefront/            # Public storefront pages
│   │   └── SuperAdmin/            # Super Admin pages (/super-admin/*)
│   ├── App.jsx                    # Route configuration & layout manager
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Design system tokens & global styling
│
├── package.json                   # Dependencies & scripts
└── vite.config.js                 # Vite bundler configuration
```

---

## 4. Default Access Credentials & System Routes

| Role | Username / Email | Password | Access Route |
| :--- | :--- | :--- | :--- |
| **Platform Super Admin** | `superadmin@platform.com` | `SuperAdminMaster123!` | [`/super-admin/login`](http://localhost:5000/super-admin/login) |
| **Store Administrator** | `admin@store.com` | `AdminSecret123!` | [`/admin/login`](http://localhost:5000/admin/login) |
| **B2B Wholesale Client** | `client@apexglobal.com` | `TempPassword123!` | [`/b2b/login`](http://localhost:5000/b2b/login) |
| **B2B Tester Account** | `jorge@sdinterstatebatteries.com` | `TempPassword123!` | [`/b2b/login`](http://localhost:5000/b2b/login) |
| **B2B Partner Account** | `orders@nexusretail.com` | `PartnerPass123!` | [`/b2b/login`](http://localhost:5000/b2b/login) |

---

## 5. How to Run & Deploy Outside Gemini

### Environment Setup
- **Node.js**: Version 18.x or higher
- **Package Manager**: `npm`

### Installation & Execution Commands
```bash
# 1. Install dependencies
npm install

# 2. Start the Express Backend Server (Runs on http://localhost:5000)
node server/index.js

# 3. Start the Frontend Development Server (Runs on http://localhost:5173 or Vite port)
npm run dev

# 4. Build for Production Deployment
npm run build
```
