import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Users, BarChart3, ScanLine } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">RackTrack WMS</h1>
          <p className="text-xl text-gray-600">
            Warehouse Management System for Screen Printing Companies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <Package className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>Track products, pallets, and locations in real-time</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <ScanLine className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Barcode Scanning</CardTitle>
              <CardDescription>Mobile-optimized scanning for warehouse operations</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Job Management</CardTitle>
              <CardDescription>Create and track jobs from purchase orders</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <BarChart3 className="h-10 w-10 text-primary mb-2" />
              <CardTitle>QuickBooks Integration</CardTitle>
              <CardDescription>Seamless sync with QuickBooks Online</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="flex justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="text-lg px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/docs">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Documentation
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}