@echo off
echo Running RackTrack build test...
echo ================================

echo Cleaning previous builds...
rmdir /s /q .next 2>nul

echo Checking TypeScript...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo TypeScript errors found!
    exit /b 1
)
echo TypeScript check passed!

echo Building application...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo ================================
echo Build completed successfully!
echo Ready to deploy!
pause