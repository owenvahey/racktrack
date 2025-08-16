'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Type,
  QrCode,
  Barcode,
  Image,
  Square,
  Circle,
  Minus,
  Move
} from 'lucide-react'
import { LabelElement } from '../lib/label-elements'

interface LabelToolbarProps {
  onAddElement: (element: Omit<LabelElement, 'id'>) => void
}

export function LabelToolbar({ onAddElement }: LabelToolbarProps) {
  const tools = [
    {
      icon: Move,
      label: 'Select',
      action: null, // Selection tool, no element to add
    },
    {
      icon: Type,
      label: 'Text',
      action: () => onAddElement({
        type: 'text',
        x: 20,
        y: 20,
        width: 100,
        height: 30,
        content: 'Label Text',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left'
      } as Omit<LabelElement, 'id'>)
    },
    {
      icon: Barcode,
      label: 'Barcode',
      action: () => onAddElement({
        type: 'barcode',
        x: 20,
        y: 20,
        width: 150,
        height: 50,
        value: '123456789',
        format: 'CODE128',
        showText: true,
        textPosition: 'bottom'
      } as Omit<LabelElement, 'id'>)
    },
    {
      icon: QrCode,
      label: 'QR Code',
      action: () => onAddElement({
        type: 'qrcode',
        x: 20,
        y: 20,
        width: 80,
        height: 80,
        value: 'https://example.com',
        errorCorrectionLevel: 'M'
      } as Omit<LabelElement, 'id'>)
    },
    {
      icon: Square,
      label: 'Rectangle',
      action: () => onAddElement({
        type: 'shape',
        x: 20,
        y: 20,
        width: 100,
        height: 60,
        shapeType: 'rectangle',
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 2
      } as Omit<LabelElement, 'id'>)
    },
    {
      icon: Circle,
      label: 'Circle',
      action: () => onAddElement({
        type: 'shape',
        x: 20,
        y: 20,
        width: 60,
        height: 60,
        shapeType: 'circle',
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 2
      } as Omit<LabelElement, 'id'>)
    },
    {
      icon: Minus,
      label: 'Line',
      action: () => onAddElement({
        type: 'line',
        x: 20,
        y: 20,
        x2: 120,
        y2: 20,
        width: 100,
        height: 2,
        stroke: '#000000',
        strokeWidth: 2
      } as Omit<LabelElement, 'id'>)
    },
    {
      icon: Image,
      label: 'Image',
      action: () => onAddElement({
        type: 'image',
        x: 20,
        y: 20,
        width: 80,
        height: 80,
        src: '/placeholder-logo.png',
        objectFit: 'contain'
      } as Omit<LabelElement, 'id'>)
    }
  ]

  return (
    <TooltipProvider>
      <div className="p-2 space-y-1">
        {tools.map((tool, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-12"
                onClick={tool.action || undefined}
                disabled={!tool.action}
              >
                <tool.icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}