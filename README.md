# Inventory Management App

A professional multi-industry inventory management app for tracking items, storage locations, and analytics. Supports multiple industry types with customized workflows for Retail, Restaurant, and Hospitality businesses.

## Features

### Multi-Industry Support
- **Retail** - Track products, SKUs, inventory levels, and sales
- **Restaurant** - Manage ingredients, track expiration, monitor stock levels, and prep sheets
- **Hospitality** - Track room supplies, amenities, and maintenance items
- Industry-specific categories, fields, and status options
- Change industry type anytime via Settings or Sidebar menu

### Authentication & Organizations
- Email/password sign up and login
- Create a new organization or join an existing one
- Share organization invite code with team members
- All organization members share the same inventory
- Organization-based data isolation

### Home Dashboard
- **Customizable metrics** - Choose which metrics to display on your dashboard
- Available metrics include:
  - Total Items
  - In Stock / Active items
  - Low Stock alerts
  - Total Inventory Value (monetary value on hand)
  - Total COGS (Cost of Goods Sold)
  - Potential Profit (expected profit if all items sell)
  - Items Expiring Soon
  - Below Par (items at zero quantity)
  - Needs Attention
  - Items Sold
  - Average Item Value
  - Categories Count
- Tap "Customize" to add/remove metrics
- Metrics persist across app sessions
- Industry-themed colors and icons
- Quick action buttons for scanning items and searching

### Analytics
- Weekly activity tracking with bar charts
- Category/Type breakdown by industry
- Status distribution overview
- Week-over-week comparison trends
- Total value and average value metrics
- **Cost of Goods Sold (COGS)** section with:
  - Revenue from sold items
  - Cost of Goods Sold calculation
  - Gross Profit and Margin percentage
  - Inventory cost breakdown (Total, Sold, Remaining)

### Inventory Management
- Add items with photos (camera or gallery)
- **AI Smart Scanner** - Scan photos with AI to automatically detect and add items
- **AI Item Counter** - Count items in photos using AI vision with individual item detection
  - Lists each detected item with name, description, and quantity
  - Edit AI-generated descriptions before saving
  - Add counted items directly to Cycle Counts or Prep Sheets (Restaurant)
- **Invoice Input** - Enter products from invoices with automatic inventory matching
  - **AI Invoice Scanner** - Scan invoice photos with AI to automatically extract line items
  - Add multiple line items with product name, quantity, and unit cost
  - Auto-matches product names to existing inventory items
  - Option to create new inventory items for unmatched products
  - Updates existing item quantities or creates new items in bulk
- Import listings from Mercari or Depop stores
- Store item details: name, description, quantity, custom location fields
- **Quantity tracking** - Track how many of each item you have
- **Cost tracking** - Record purchase/acquisition cost for COGS calculations
- **Par levels** - Set minimum stock levels for each item
- **Vendor assignment** - Link items to vendors for ordering
- Customizable storage location fields (bin, rack, shelf, etc.)
- Industry-specific status labels (In Stock/Available, Sold/Used/In Use)
- Search by name, bin, rack, or platform
- Sort items by newest or oldest first
- Find items by photo (camera or photo library)
- Edit items after creation

### Vendor Management & Orders
- **Create and manage vendors** - Add vendor name, contact info, email, phone
- **Link products to vendors** - Associate inventory items with their vendors
- **Create purchase orders** - Build orders from selected vendor's products
- **Auto-suggest below-par items** - When creating an order, items below par level are automatically added
- **Order workflow** - Draft → Submitted → Received status tracking
- **Receive orders** - Mark orders as received to automatically update inventory quantities
- View order history and details

### Cycle Counts (Inventory Verification)
- **Create cycle counts** - Start a new count to verify all inventory quantities
- Track progress with visual indicators showing counted vs remaining items
- **Record actual counts** - Quick confirm expected quantity or enter actual count
- **Variance tracking** - Automatically calculates and highlights discrepancies
- Add notes to individual item counts
- Filter items by status (all, uncounted, counted, with variance)
- **Apply changes** - Option to update inventory quantities when completing count
- View history of completed cycle counts

### Import Listings
- Import from Mercari (mercari.com/u/USERNAME)
- Import from Depop (depop.com/USERNAME)
- Auto-detect platform from URL
- Preview listings before importing
- Select which items to import
- Pulls title, price, photos, description, and status
- Batch import multiple items at once

### Storage Settings
- Customize location field names (e.g., Bin, Rack, Shelf, Room)
- Add or remove location fields
- Enable/disable fields without deleting
- Set placeholder text for each field

### Item Details
- Full item information display
- Edit mode for updating item details
- Industry-specific location labels (Aisle/Shelf, Storage/Section, Room/Floor)
- Industry-specific action buttons (Mark as Sold, Mark as Used, etc.)
- Status actions with industry context

### Prep Sheet (Restaurant Only)
- **SmartScan integration**: Use AI to scan and auto-fill prep items from photos
- Create and manage prep items with par levels
- Standard restaurant measurement units (each, pint, quart, pan, half pan, third pan, sixth pan, lb, oz, kg, g, cup, tbsp, tsp, dozen, case, bag, box, bottle, bunch, head, slice, portion)
- Track current levels vs par levels
- Visual progress indicators showing prep status
- Quick prep buttons to log prep completions
- Category-based organization (Produce, Meat & Poultry, Seafood, Dairy, Dry Goods, Sauces & Dressings, Baked Goods, Desserts, Beverages, Mise en Place)
- Filter and search prep items
- Prep history logging with timestamps

## Tech Stack

### Frontend
- Expo SDK 53 with React Native
- Expo Router for navigation
- NativeWind (TailwindCSS) for styling
- React Query for server state
- Zustand for local state (industry selection)
- Lucide icons
- expo-camera for photo capture

### Backend
- Bun runtime with Hono server
- Prisma ORM with SQLite
- Better Auth for authentication
- Image upload support

## Industry Configurations

### Retail
- **Categories**: Electronics, Clothing, Home & Garden, Sports & Outdoors, Beauty & Health, Toys & Games, Food & Beverages, Office Supplies, Automotive
- **Status Options**: In Stock, Low Stock, Out of Stock, Discontinued
- **Color Theme**: Violet (#8B5CF6)

### Restaurant
- **Categories**: Produce, Meat & Poultry, Seafood, Dairy, Dry Goods, Frozen, Beverages, Condiments & Sauces, Spices & Seasonings, Paper & Supplies, Cleaning Supplies
- **Status Options**: Fresh, Expiring Soon, Expired, Low Stock, Out of Stock
- **Color Theme**: Amber (#F59E0B)

### Hospitality
- **Categories**: Linens & Towels, Toiletries, Room Amenities, Furniture, Electronics, Cleaning Supplies, Kitchen Equipment, Maintenance Tools, Safety Equipment, Decorations
- **Status Options**: Available, In Use, Needs Cleaning, Needs Repair, Out of Service
- **Color Theme**: Cyan (#06B6D4)

## Database Schema

### InventoryItem
- `id` - Unique identifier
- `name` - Item name
- `description` - Optional description
- `imageUrl` - Photo URL
- `binNumber` - Storage bin location
- `rackNumber` - Storage rack location
- `platform` - Category/type
- `status` - pending | sold | completed
- `cost` - Purchase/acquisition cost (for COGS)
- `soldAt` - Sale timestamp
- `soldPrice` - Sale price
- `organizationId` - Reference to Organization
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Organization
- `id` - Unique identifier
- `name` - Organization name
- `inviteCode` - 6-character code for joining
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### OrganizationMember
- `id` - Unique identifier
- `organizationId` - Reference to Organization
- `userId` - Reference to User
- `role` - owner | admin | member
- `createdAt` - Joined timestamp

### PrepItem (Restaurant)
- `id` - Unique identifier
- `name` - Item name
- `category` - Prep category
- `itemType` - "ingredient" or "prepped"
- `parLevel` - Minimum quantity to maintain
- `currentLevel` - Current quantity on hand
- `unit` - Measurement unit (each, pint, quart, pan, lb, oz, etc.)
- `notes` - Special instructions
- `sortOrder` - Custom ordering
- `isActive` - Active/hidden status
- `organizationId` - Reference to Organization
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### PrepLog
- `id` - Unique identifier
- `prepItemId` - Reference to PrepItem
- `quantityPrepped` - Amount prepped
- `preppedBy` - Who did the prep
- `notes` - Notes about this prep
- `createdAt` - Prep timestamp

## API Endpoints

- `GET /api/inventory` - Get all items with stats
- `GET /api/inventory/:id` - Get single item
- `POST /api/inventory` - Create new item
- `PATCH /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item
- `POST /api/inventory/search` - Search items
- `POST /api/inventory/search-by-photo` - Search items by photo
- `POST /api/upload/image` - Upload image
- `POST /api/import/scrape` - Scrape listings from Mercari or Depop
- `GET /api/organization` - Get current user's organization
- `POST /api/organization` - Create a new organization
- `POST /api/organization/join` - Join organization with invite code
- `POST /api/organization/leave` - Leave current organization
- `PATCH /api/organization` - Update organization name
- `POST /api/organization/regenerate-code` - Generate new invite code
- `GET /api/prep-items` - Get all prep items (Restaurant)
- `GET /api/prep-items/:id` - Get single prep item
- `POST /api/prep-items` - Create new prep item
- `PATCH /api/prep-items/:id` - Update prep item
- `DELETE /api/prep-items/:id` - Delete prep item
- `POST /api/prep-items/:id/log` - Log prep completion
- `GET /api/prep-items/:id/logs` - Get prep logs for item
- `POST /api/prep-items/update-levels` - Batch update current levels

## Color Scheme

- Primary: Charcoal Grey (#1C1C1E)
- Retail Accent: Violet (#8B5CF6)
- Restaurant Accent: Amber (#F59E0B)
- Hospitality Accent: Cyan (#06B6D4)
- Active/In Stock: Emerald (#10B981)
- Warning: Amber (#F59E0B)
- Completed: Violet (#8B5CF6)
