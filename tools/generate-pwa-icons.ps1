$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

function New-PwaIcon([int]$size, [string]$filename, [bool]$maskable = $false) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::White)

  $scale = ($size / 192.0) * $(if ($maskable) { 0.8 } else { 1.0 })
  $inset = $(if ($maskable) { $size * 0.1 } else { 0.0 })
  $graphics.Transform = [System.Drawing.Drawing2D.Matrix]::new([single]$scale, 0, 0, [single]$scale, [single]$inset, [single]$inset)

  $black = [System.Drawing.Color]::FromArgb(23, 23, 23)
  $background = [System.Drawing.SolidBrush]::new($black)
  $tile = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $tile.AddArc(0, 0, 102, 102, 180, 90)
  $tile.AddArc(90, 0, 102, 102, 270, 90)
  $tile.AddArc(90, 90, 102, 102, 0, 90)
  $tile.AddArc(0, 90, 102, 102, 90, 90)
  $tile.CloseFigure()
  $graphics.FillPath($background, $tile)

  $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $speedLines = @(
    [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(35, 70), [System.Drawing.PointF]::new(60, 70), [System.Drawing.PointF]::new(57, 75), [System.Drawing.PointF]::new(35, 75)),
    [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(40, 81), [System.Drawing.PointF]::new(57, 81), [System.Drawing.PointF]::new(54, 86), [System.Drawing.PointF]::new(40, 86)),
    [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(44, 92), [System.Drawing.PointF]::new(54, 92), [System.Drawing.PointF]::new(51, 97), [System.Drawing.PointF]::new(44, 97))
  )
  foreach ($line in $speedLines) { $graphics.FillPolygon($whiteBrush, $line) }

  $carPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 4)
  $carPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $carPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $carPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $car = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $car.StartFigure()
  $car.AddLine(60, 109, 62, 101)
  $car.AddBezier(62, 101, 63, 98, 65, 96, 68, 94)
  $car.AddLine(68, 94, 81, 77)
  $car.AddBezier(81, 77, 84, 73, 88, 72, 93, 72)
  $car.AddLine(93, 72, 105, 72)
  $car.AddBezier(105, 72, 112, 72, 117, 75, 122, 80)
  $car.AddLine(122, 80, 133, 91)
  $car.AddLine(133, 91, 145, 95)
  $car.AddBezier(145, 95, 151, 97, 154, 101, 154, 107)
  $car.AddLine(154, 107, 154, 111)
  $car.AddBezier(154, 111, 154, 115, 151, 118, 147, 120)
  $car.AddLine(147, 120, 142, 122)
  $graphics.DrawPath($carPen, $car)

  foreach ($centerX in @(78, 134)) {
    $graphics.FillEllipse($background, $centerX - 9, 100, 18, 18)
    $graphics.DrawEllipse($carPen, $centerX - 9, 100, 18, 18)
  }
  $graphics.DrawLine($carPen, 87, 109, 125, 109)

  $path = Join-Path $iconsDir $filename
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $tile.Dispose(); $car.Dispose(); $background.Dispose(); $whiteBrush.Dispose(); $carPen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-PwaIcon 180 'xswift-180.png'
New-PwaIcon 192 'xswift-192.png'
New-PwaIcon 512 'xswift-512.png'
New-PwaIcon 512 'xswift-512-maskable.png' $true
