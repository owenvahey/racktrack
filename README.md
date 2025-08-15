# RackTrack WMS

A modern Warehouse Management System built for screen printing companies, featuring inventory management, barcode scanning, and QuickBooks integration.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-2.0-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-blueviolet)

## 🚀 Features

### ✅ Implemented
- **Authentication & User Management**
  - Email/password authentication
  - Role-based access control (Admin, Manager, Worker, Viewer)
  - User profile management with avatar upload
  - Admin user management interface

- **Inventory Management**
  - Product catalog with SKU and barcode tracking
  - Real-time inventory tracking
  - Mobile-optimized barcode scanning
  - Receive inventory with lot/batch tracking
  - Quality status management
  - Movement audit trail

- **Mobile Scanning**
  - Camera-based barcode/QR code scanning
  - Product lookup by barcode
  - Pallet tracking
  - Offline capability

### 🚧 In Development
- Pallet management system
- Warehouse location management
- Inventory adjustments and cycle counts
- Advanced reporting and analytics

### 📋 Planned
- QuickBooks Online integration
- Purchase order management
- Job tracking system
- Automated invoice generation

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: Shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **State Management**: Zustand + TanStack Query
- **Barcode Scanning**: html5-qrcode
- **Forms**: React Hook Form + Zod validation

## 📦 Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/racktrack.git
cd racktrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Update `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database migrations in your Supabase SQL editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_inventory_schema.sql`

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📱 Mobile Scanning

The barcode scanning feature requires:
- HTTPS connection (or localhost for development)
- Camera permissions
- A device with a camera

For production mobile use, deploy to a platform that provides HTTPS (like Vercel).

## 🗄️ Database Schema

The application uses the following main tables:
- `profiles` - User profiles with roles
- `warehouses` - Warehouse locations
- `products` - Product catalog
- `pallets` - Pallet tracking
- `inventory` - Inventory quantities
- `inventory_movements` - Movement audit trail
- `storage_slots` - Warehouse location management

## 🔐 Authentication & Roles

Four user roles with different permissions:
- **Admin**: Full system access
- **Manager**: Warehouse management, reports
- **Worker**: Inventory operations, scanning
- **Viewer**: Read-only access

## 📝 Project Structure

```
racktrack/
├── src/
│   ├── app/               # Next.js app router pages
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and configurations
│   ├── stores/           # Zustand state stores
│   └── types/            # TypeScript type definitions
├── supabase/
│   └── migrations/       # Database migration files
└── docs/                 # Project documentation
```

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/racktrack)

## 🧪 Development Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# Format code
npm run format
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database by [Supabase](https://supabase.com/)
- UI components from [Shadcn/ui](https://ui.shadcn.com/)
- Barcode scanning by [html5-qrcode](https://github.com/mebjas/html5-qrcode)

## 📞 Support

For support, email support@racktrack.com or open an issue in the GitHub repository.

---

Made with ❤️ for screen printing companies