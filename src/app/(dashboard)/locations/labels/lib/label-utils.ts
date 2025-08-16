import { LabelElement, LabelSize, inchesToPixels } from './label-elements'

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

// Grid and snapping
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize)
  }
}

// Element bounds calculation
export function getElementBounds(element: LabelElement): Bounds {
  if (element.type === 'line') {
    const left = Math.min(element.x, element.x2)
    const top = Math.min(element.y, element.y2)
    const right = Math.max(element.x, element.x2)
    const bottom = Math.max(element.y, element.y2)
    
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    }
  }
  
  return {
    left: element.x,
    top: element.y,
    right: element.x + element.width,
    bottom: element.y + element.height,
    width: element.width,
    height: element.height
  }
}

// Check if point is inside element
export function isPointInElement(point: Point, element: LabelElement): boolean {
  const bounds = getElementBounds(element)
  
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  )
}

// Element alignment helpers
export function alignElements(
  elements: LabelElement[],
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): LabelElement[] {
  if (elements.length < 2) return elements
  
  const bounds = elements.map(getElementBounds)
  
  switch (alignment) {
    case 'left': {
      const minLeft = Math.min(...bounds.map(b => b.left))
      return elements.map((el, i) => ({
        ...el,
        x: minLeft
      }))
    }
    case 'center': {
      const avgCenterX = bounds.reduce((sum, b) => sum + (b.left + b.right) / 2, 0) / bounds.length
      return elements.map((el, i) => ({
        ...el,
        x: avgCenterX - bounds[i].width / 2
      }))
    }
    case 'right': {
      const maxRight = Math.max(...bounds.map(b => b.right))
      return elements.map((el, i) => ({
        ...el,
        x: maxRight - bounds[i].width
      }))
    }
    case 'top': {
      const minTop = Math.min(...bounds.map(b => b.top))
      return elements.map((el, i) => ({
        ...el,
        y: minTop
      }))
    }
    case 'middle': {
      const avgCenterY = bounds.reduce((sum, b) => sum + (b.top + b.bottom) / 2, 0) / bounds.length
      return elements.map((el, i) => ({
        ...el,
        y: avgCenterY - bounds[i].height / 2
      }))
    }
    case 'bottom': {
      const maxBottom = Math.max(...bounds.map(b => b.bottom))
      return elements.map((el, i) => ({
        ...el,
        y: maxBottom - bounds[i].height
      }))
    }
  }
}

// Distribute elements evenly
export function distributeElements(
  elements: LabelElement[],
  direction: 'horizontal' | 'vertical'
): LabelElement[] {
  if (elements.length < 3) return elements
  
  const sortedElements = [...elements].sort((a, b) => 
    direction === 'horizontal' ? a.x - b.x : a.y - b.y
  )
  
  const bounds = sortedElements.map(getElementBounds)
  
  if (direction === 'horizontal') {
    const totalWidth = bounds.reduce((sum, b) => sum + b.width, 0)
    const totalGap = bounds[bounds.length - 1].right - bounds[0].left - totalWidth
    const gap = totalGap / (elements.length - 1)
    
    let currentX = bounds[0].left
    return sortedElements.map((el, i) => {
      const newEl = { ...el, x: currentX }
      currentX += bounds[i].width + gap
      return newEl
    })
  } else {
    const totalHeight = bounds.reduce((sum, b) => sum + b.height, 0)
    const totalGap = bounds[bounds.length - 1].bottom - bounds[0].top - totalHeight
    const gap = totalGap / (elements.length - 1)
    
    let currentY = bounds[0].top
    return sortedElements.map((el, i) => {
      const newEl = { ...el, y: currentY }
      currentY += bounds[i].height + gap
      return newEl
    })
  }
}

// Data field replacement
export function replaceDataFields(text: string, data: Record<string, any>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
    const keys = field.trim().split('.')
    let value: any = data
    
    for (const key of keys) {
      value = value?.[key]
      if (value === undefined) break
    }
    
    return value !== undefined ? String(value) : match
  })
}

// Export label design
export interface LabelDesign {
  size: LabelSize
  elements: LabelElement[]
  settings: {
    gridSize: number
    showGrid: boolean
    showRulers: boolean
    units: 'inches' | 'mm'
  }
}

export function exportLabelDesign(design: LabelDesign): string {
  return JSON.stringify(design, null, 2)
}

export function importLabelDesign(json: string): LabelDesign | null {
  try {
    const design = JSON.parse(json)
    // Basic validation
    if (!design.size || !Array.isArray(design.elements)) {
      return null
    }
    return design
  } catch {
    return null
  }
}

// Convert label to print-ready format
export function labelToPrintFormat(
  elements: LabelElement[],
  size: LabelSize,
  dpi: number = 203
): {
  width: number
  height: number
  elements: LabelElement[]
} {
  const widthPx = inchesToPixels(size.width, dpi)
  const heightPx = inchesToPixels(size.height, dpi)
  
  // Scale all element positions and sizes
  const scaledElements = elements.map(el => {
    const scaled: any = {
      ...el,
      x: inchesToPixels(el.x / 100 * size.width, dpi),
      y: inchesToPixels(el.y / 100 * size.height, dpi),
      width: inchesToPixels(el.width / 100 * size.width, dpi),
      height: inchesToPixels(el.height / 100 * size.height, dpi)
    }
    
    if (el.type === 'line') {
      scaled.x2 = inchesToPixels(el.x2 / 100 * size.width, dpi)
      scaled.y2 = inchesToPixels(el.y2 / 100 * size.height, dpi)
    }
    
    if (el.type === 'text') {
      scaled.fontSize = el.fontSize * (dpi / 72) // Convert points to pixels
    }
    
    return scaled
  })
  
  return {
    width: widthPx,
    height: heightPx,
    elements: scaledElements
  }
}