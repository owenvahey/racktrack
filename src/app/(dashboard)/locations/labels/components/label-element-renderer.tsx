'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { LabelElement } from '../lib/label-elements'
const QRCode = require('qrcode.react')

interface LabelElementRendererProps {
  element: LabelElement
  isSelected: boolean
  isDragging: boolean
  onClick: (e: React.MouseEvent) => void
}

export function LabelElementRenderer({
  element,
  isSelected,
  isDragging,
  onClick,
}: LabelElementRendererProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: element.id,
  })

  const style = {
    position: 'absolute' as const,
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: CSS.Translate.toString(transform),
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.5 : 1,
    outline: isSelected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
  }

  const renderElement = () => {
    switch (element.type) {
      case 'text':
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              fontSize: element.fontSize,
              fontFamily: element.fontFamily,
              fontWeight: element.fontWeight,
              color: element.color,
              textAlign: element.align,
              lineHeight: element.lineHeight,
              letterSpacing: element.letterSpacing,
              display: 'flex',
              alignItems: 'center',
              justifyContent: element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start',
              padding: '2px',
              overflow: 'hidden',
            }}
          >
            {element.isVariable ? `{{${element.dataField || element.content}}}` : element.content}
          </div>
        )

      case 'barcode':
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              border: '1px solid #ddd',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                background: `repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)`,
              }}
            />
            {element.showText && (
              <div
                style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  padding: '2px',
                  textAlign: 'center',
                }}
              >
                {element.isVariable ? `{{${element.dataField}}}` : element.value}
              </div>
            )}
          </div>
        )

      case 'qrcode':
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
            }}
          >
            {element.isVariable ? (
              <div
                style={{
                  width: '80%',
                  height: '80%',
                  background: '#f0f0f0',
                  border: '2px dashed #999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#666',
                  textAlign: 'center',
                  padding: '8px',
                }}
              >
                QR: {`{{${element.dataField}}}`}
              </div>
            ) : (
              <QRCode
                value={element.value}
                size={Math.min(element.width, element.height) * 0.8}
                level={element.errorCorrectionLevel}
              />
            )}
          </div>
        )

      case 'image':
        return (
          <img
            src={element.src}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: element.objectFit,
            }}
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNSIvPgogIDx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZTwvdGV4dD4KPC9zdmc+'
            }}
          />
        )

      case 'shape':
        if (element.shapeType === 'circle') {
          return (
            <svg width="100%" height="100%">
              <circle
                cx={element.width / 2}
                cy={element.height / 2}
                r={Math.min(element.width, element.height) / 2 - (element.strokeWidth || 0) / 2}
                fill={element.fill || 'transparent'}
                stroke={element.stroke}
                strokeWidth={element.strokeWidth}
              />
            </svg>
          )
        } else if (element.shapeType === 'rounded-rectangle') {
          return (
            <svg width="100%" height="100%">
              <rect
                x={element.strokeWidth ? element.strokeWidth / 2 : 0}
                y={element.strokeWidth ? element.strokeWidth / 2 : 0}
                width={element.width - (element.strokeWidth || 0)}
                height={element.height - (element.strokeWidth || 0)}
                rx={element.cornerRadius || 5}
                fill={element.fill || 'transparent'}
                stroke={element.stroke}
                strokeWidth={element.strokeWidth}
              />
            </svg>
          )
        } else {
          return (
            <svg width="100%" height="100%">
              <rect
                x={element.strokeWidth ? element.strokeWidth / 2 : 0}
                y={element.strokeWidth ? element.strokeWidth / 2 : 0}
                width={element.width - (element.strokeWidth || 0)}
                height={element.height - (element.strokeWidth || 0)}
                fill={element.fill || 'transparent'}
                stroke={element.stroke}
                strokeWidth={element.strokeWidth}
              />
            </svg>
          )
        }

      case 'line':
        return (
          <svg
            width={Math.abs(element.x2 - element.x)}
            height={Math.abs(element.y2 - element.y)}
            style={{
              position: 'absolute',
              left: Math.min(element.x, element.x2),
              top: Math.min(element.y, element.y2),
              pointerEvents: 'none',
            }}
          >
            <line
              x1={element.x < element.x2 ? 0 : Math.abs(element.x2 - element.x)}
              y1={element.y < element.y2 ? 0 : Math.abs(element.y2 - element.y)}
              x2={element.x2 > element.x ? Math.abs(element.x2 - element.x) : 0}
              y2={element.y2 > element.y ? Math.abs(element.y2 - element.y) : 0}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              strokeDasharray={element.strokeStyle === 'dashed' ? '5,5' : element.strokeStyle === 'dotted' ? '2,2' : undefined}
            />
          </svg>
        )

      default:
        return null
    }
  }

  if (element.type === 'line') {
    // Lines need special handling since they don't have a traditional bounding box
    return renderElement()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      {renderElement()}
      
      {/* Resize handles when selected */}
      {isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white cursor-nw-resize" />
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white cursor-n-resize" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white cursor-ne-resize" />
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white cursor-e-resize" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white cursor-se-resize" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white cursor-s-resize" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white cursor-sw-resize" />
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white cursor-w-resize" />
        </>
      )}
    </div>
  )
}