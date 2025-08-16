'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft,
  Save,
  Download,
  Upload,
  Printer,
  Plus,
  Grid3x3,
  Eye,
  Layers,
  Settings
} from 'lucide-react'
import { LabelCanvas } from './components/label-canvas'
import { LabelToolbar } from './components/label-toolbar'
import { LabelProperties } from './components/label-properties'
import { LabelTemplates } from './components/label-templates'
import { LabelPreview } from './components/label-preview'
import { 
  LabelElement, 
  LabelSize, 
  STANDARD_LABEL_SIZES,
  generateElementId 
} from './lib/label-elements'
import { exportLabelDesign, importLabelDesign } from './lib/label-utils'
import { toast } from 'sonner'

export default function LabelGeneratorPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('design')
  const [selectedSize, setSelectedSize] = useState<LabelSize>(STANDARD_LABEL_SIZES[0])
  const [elements, setElements] = useState<LabelElement[]>([])
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showRulers, setShowRulers] = useState(true)
  const [gridSize, setGridSize] = useState(10)
  const [zoom, setZoom] = useState(1)

  // Add element to canvas
  const addElement = (element: Omit<LabelElement, 'id'>) => {
    const newElement = {
      ...element,
      id: generateElementId()
    } as LabelElement
    
    setElements([...elements, newElement])
    setSelectedElement(newElement.id)
  }

  // Update element
  const updateElement = (id: string, updates: Partial<LabelElement>) => {
    setElements(elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ))
  }

  // Delete element
  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id))
    if (selectedElement === id) {
      setSelectedElement(null)
    }
  }

  // Duplicate element
  const duplicateElement = (id: string) => {
    const element = elements.find(el => el.id === id)
    if (element) {
      const newElement = {
        ...element,
        id: generateElementId(),
        x: element.x + 10,
        y: element.y + 10
      }
      setElements([...elements, newElement])
      setSelectedElement(newElement.id)
    }
  }

  // Clear canvas
  const clearCanvas = () => {
    if (confirm('Are you sure you want to clear all elements?')) {
      setElements([])
      setSelectedElement(null)
    }
  }

  // Export design
  const exportDesign = () => {
    const design = {
      size: selectedSize,
      elements,
      settings: {
        gridSize,
        showGrid,
        showRulers,
        units: 'inches' as const
      }
    }
    
    const json = exportLabelDesign(design)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `label-design-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Design exported successfully')
  }

  // Import design
  const importDesign = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const json = e.target?.result as string
      const design = importLabelDesign(json)
      
      if (design) {
        setSelectedSize(design.size)
        setElements(design.elements)
        setGridSize(design.settings.gridSize)
        setShowGrid(design.settings.showGrid)
        setShowRulers(design.settings.showRulers)
        toast.success('Design imported successfully')
      } else {
        toast.error('Invalid design file')
      }
    }
    reader.readAsText(file)
  }

  // Apply template
  const applyTemplate = (templateElements: LabelElement[], size: LabelSize) => {
    setSelectedSize(size)
    setElements(templateElements.map(el => ({
      ...el,
      id: generateElementId()
    })))
    setSelectedElement(null)
    setActiveTab('design')
    toast.success('Template applied')
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Label Designer</h1>
              <p className="text-sm text-muted-foreground">
                Create custom labels for locations, products, and pallets
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              disabled={elements.length === 0}
            >
              Clear
            </Button>
            
            <label>
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={importDesign}
              />
            </label>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportDesign}
              disabled={elements.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button
              size="sm"
              onClick={() => setActiveTab('preview')}
              disabled={elements.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-4">
            <TabsList>
              <TabsTrigger value="templates">
                <Grid3x3 className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="design">
                <Layers className="h-4 w-4 mr-2" />
                Design
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="templates" className="h-full p-4">
            <LabelTemplates
              onSelectTemplate={applyTemplate}
              currentSize={selectedSize}
            />
          </TabsContent>

          <TabsContent value="design" className="h-full">
            <div className="h-full flex">
              {/* Left Toolbar */}
              <div className="w-20 border-r bg-muted/30">
                <LabelToolbar onAddElement={addElement} />
              </div>

              {/* Canvas Area */}
              <div className="flex-1 overflow-hidden">
                <LabelCanvas
                  size={selectedSize}
                  elements={elements}
                  selectedElement={selectedElement}
                  showGrid={showGrid}
                  showRulers={showRulers}
                  gridSize={gridSize}
                  zoom={zoom}
                  onSelectElement={setSelectedElement}
                  onUpdateElement={updateElement}
                  onDeleteElement={deleteElement}
                  onDuplicateElement={duplicateElement}
                  onSizeChange={setSelectedSize}
                  onZoomChange={setZoom}
                  onGridToggle={() => setShowGrid(!showGrid)}
                  onRulersToggle={() => setShowRulers(!showRulers)}
                  onGridSizeChange={setGridSize}
                />
              </div>

              {/* Right Properties Panel */}
              <div className="w-80 border-l bg-muted/30">
                <LabelProperties
                  element={elements.find(el => el.id === selectedElement)}
                  onUpdate={(updates) => {
                    if (selectedElement) {
                      updateElement(selectedElement, updates)
                    }
                  }}
                  onDelete={() => {
                    if (selectedElement) {
                      deleteElement(selectedElement)
                    }
                  }}
                  onDuplicate={() => {
                    if (selectedElement) {
                      duplicateElement(selectedElement)
                    }
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="h-full p-4">
            <LabelPreview
              size={selectedSize}
              elements={elements}
              onPrint={() => {
                toast.success('Printing...')
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}