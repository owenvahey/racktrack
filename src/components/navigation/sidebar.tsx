'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Package,
  Users,
  BarChart3,
  ScanLine,
  Settings,
  Home,
  ShoppingCart,
  Briefcase,
  FileText,
} from 'lucide-react'

interface SidebarProps {
  userRole: 'admin' | 'manager' | 'worker' | 'viewer'
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'manager', 'worker', 'viewer'] },
  { name: 'Inventory', href: '/inventory', icon: Package, roles: ['admin', 'manager', 'worker', 'viewer'] },
  { name: 'Scan', href: '/scan', icon: ScanLine, roles: ['admin', 'manager', 'worker'] },
  { name: 'Jobs', href: '/jobs', icon: Briefcase, roles: ['admin', 'manager', 'worker', 'viewer'] },
  { name: 'Orders', href: '/orders', icon: ShoppingCart, roles: ['admin', 'manager', 'viewer'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'manager', 'viewer'] },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['admin', 'manager'] },
  { name: 'Admin', href: '/admin', icon: Settings, roles: ['admin'] },
]

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(userRole)
  )

  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <h1 className="text-white text-xl font-bold">RackTrack WMS</h1>
      </div>
      <nav className="flex-1 px-2 py-4 bg-gray-900">
        {filteredNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md mb-1',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5',
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 group-hover:text-gray-300'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}