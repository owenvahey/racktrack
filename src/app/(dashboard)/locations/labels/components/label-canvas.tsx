'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
} from '@dnd-kit/modifiers'
import { 
  ZoomIn, 
  ZoomOut, 
  Grid3x3, 
  Ruler,
  RotateCw
} from 'lucide-react'
import { 
  LabelElement, 
  LabelSize, 
  STANDARD_LABEL_SIZES,
  inchesToPixels 
} from '../lib/label-elements'
import { snapToGrid, isPointInElement } from '../lib/label-utils'
import { LabelElementRenderer } from './label-element-renderer'

interface LabelCanvasProps {
  size: LabelSize
  elements: LabelElement[]
  selectedElement: string | null
  showGrid: boolean
  showRulers: boolean
  gridSize: number
  zoom: number
  onSelectElement: (id: string | null) => void
  onUpdateElement: (id: string, updates: Partial<LabelElement>) => void
  onDeleteElement: (id: string) => void
  onDuplicateElement: (id: string) => void
  onSizeChange: (size: LabelSize) => void
  onZoomChange: (zoom: number) => void
  onGridToggle: () => void
  onRulersToggle: () => void
  onGridSizeChange: (size: number) => void
}

export function LabelCanvas({
  size,
  elements,
  selectedElement,
  showGrid,
  showRulers,
  gridSize,
  zoom,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onSizeChange,
  onZoomChange,
  onGridToggle,
  onRulersToggle,
  onGridSizeChange,
}: LabelCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggedElement, setDraggedElement] = useState<string | null>(null)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Calculate canvas size in pixels
  useEffect(() => {
    const dpi = 96 // Screen DPI for display
    const width = inchesToPixels(size.width, dpi)
    const height = inchesToPixels(size.height, dpi)
    setCanvasSize({ width, height })
  }, [size])

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectElement(null)
    }
  }

  // Handle element click
  const handleElementClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectElement(id)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElement) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDeleteElement(selectedElement)
      } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onDuplicateElement(selectedElement)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElement, onDeleteElement, onDuplicateElement])

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event
    const elementId = active.id as string
    const element = elements.find(el => el.id === elementId)
    
    if (element && delta) {
      const newX = showGrid 
        ? snapToGrid(element.x + delta.x / zoom, gridSize)
        : element.x + delta.x / zoom
      const newY = showGrid
        ? snapToGrid(element.y + delta.y / zoom, gridSize)
        : element.y + delta.y / zoom
        
      onUpdateElement(elementId, { x: newX, y: newY })
    }
    
    setDraggedElement(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedElement(event.active.id as string)
  }

  // Render grid
  const renderGrid = () => {
    if (!showGrid) return null

    const lines = []
    const step = gridSize
    
    // Vertical lines
    for (let x = 0; x <= canvasSize.width; x += step) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={canvasSize.height}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )
    }
    
    // Horizontal lines
    for (let y = 0; y <= canvasSize.height; y += step) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={canvasSize.width}
          y2={y}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )
    }
    
    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={canvasSize.width}
        height={canvasSize.height}
      >
        {lines}
      </svg>
    )
  }

  // Render rulers
  const renderRulers = () => {
    if (!showRulers) return null

    const majorTick = 100
    const minorTick = 10
    
    return (
      <>
        {/* Top ruler */}
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gray-100 border-b text-xs flex items-end">
          {Array.from({ length: Math.ceil(canvasSize.width / majorTick) + 1 }).map((_, i) => (
            <div
              key={`top-${i}`}
              className="absolute bottom-0"
              style={{ left: i * majorTick }}
            >
              <div className="h-2 w-px bg-gray-400" />
              <span className="absolute -left-4 bottom-2 text-[10px] text-gray-600">
                {i}″
              </span>
            </div>
          ))}
        </div>
        
        {/* Left ruler */}
        <div className="absolute top-0 -left-6 bottom-0 w-6 bg-gray-100 border-r text-xs flex items-start flex-col">
          {Array.from({ length: Math.ceil(canvasSize.height / majorTick) + 1 }).map((_, i) => (
            <div
              key={`left-${i}`}
              className="absolute left-0"
              style={{ top: i * majorTick }}
            >
              <div className="w-2 h-px bg-gray-400" />
              <span className="absolute left-2 -top-2 text-[10px] text-gray-600">
                {i}″
              </span>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-background p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Label Size Selector */}
            <Select
              value={`${size.width}x${size.height}`}
              onValueChange={(value) => {
                const selected = STANDARD_LABEL_SIZES.find(
                  s => `${s.width}x${s.height}` === value
                )
                if (selected) onSizeChange(selected)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_LABEL_SIZES.map((labelSize) => (
                  <SelectItem
                    key={`${labelSize.width}x${labelSize.height}`}
                    value={`${labelSize.width}x${labelSize.height}`}
                  >
                    {labelSize.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-4 w-px bg-border" />

            {/* Canvas Controls */}
            <Button
              variant={showGrid ? 'default' : 'outline'}
              size="sm"
              onClick={onGridToggle}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>

            <Button
              variant={showRulers ? 'default' : 'outline'}
              size="sm"
              onClick={onRulersToggle}
            >
              <Ruler className="h-4 w-4" />
            </Button>

            {showGrid && (
              <Select
                value={gridSize.toString()}
                onValueChange={(value) => onGridSizeChange(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5px</SelectItem>
                  <SelectItem value="10">10px</SelectItem>
                  <SelectItem value="20">20px</SelectItem>
                  <SelectItem value="25">25px</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <div className="w-32 flex items-center gap-2">
              <Slider
                value={[zoom]}
                onValueChange={([value]) => onZoomChange(value)}
                min={0.25}
                max={3}
                step={0.25}
                className="flex-1"
              />
              <span className="text-sm w-12 text-right">{Math.round(zoom * 100)}%</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoomChange(1)}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        <div className="relative inline-block">
          <DndContext
            sensors={sensors}
            modifiers={[restrictToParentElement]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg"
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
              onClick={handleCanvasClick}
            >
              {renderGrid()}
              {renderRulers()}

              {/* Elements */}
              {elements.map((element) => (
                <LabelElementRenderer
                  key={element.id}
                  element={element}
                  isSelected={selectedElement === element.id}
                  isDragging={draggedElement === element.id}
                  onClick={(e) => handleElementClick(element.id, e)}
                />
              ))}
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  )
}