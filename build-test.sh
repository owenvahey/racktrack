#!/bin/bash

echo "🔨 Running RackTrack build test..."
echo "================================"

# Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf .next

# Type check
echo "📝 Checking TypeScript..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found!"
    exit 1
fi
echo "✅ TypeScript check passed!"

# Build
echo "🏗️ Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "================================"
echo "🚀 Ready to deploy!"