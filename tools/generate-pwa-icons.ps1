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

  $scale = ($size / 512.0) * $(if ($maskable) { 0.8 } else { 1.0 })
  $inset = $(if ($maskable) { $size * 0.1 } else { 0.0 })
  $graphics.Transform = [System.Drawing.Drawing2D.Matrix]::new([single]$scale, 0, 0, [single]$scale, [single]$inset, [single]$inset)

  $ink = [System.Drawing.Color]::FromArgb(17, 17, 17)
  $roadPen = [System.Drawing.Pen]::new($ink, 54)
  $roadPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $roadPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $dashPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 9)
  $dashPen.DashPattern = [single[]]@(3, 3.45)
  $dashPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $dashPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $carPen = [System.Drawing.Pen]::new($ink, 12)
  $carPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $wheelPen = [System.Drawing.Pen]::new($ink, 10)

  $graphics.DrawLine($roadPen, 108, 112, 404, 400)
  $graphics.DrawLine($roadPen, 404, 112, 108, 400)
  $graphics.DrawLine($dashPen, 108, 112, 404, 400)
  $graphics.DrawLine($dashPen, 404, 112, 108, 400)

  $body = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $body.StartFigure()
  $body.AddLine(174, 263, 197, 242)
  $body.AddLine(197, 242, 224, 212)
  $body.AddBezier(224, 212, 232, 203, 242, 199, 255, 199)
  $body.AddLine(255, 199, 293, 199)
  $body.AddBezier(293, 199, 307, 199, 317, 204, 327, 214)
  $body.AddLine(327, 214, 351, 239)
  $body.AddLine(351, 239, 374, 248)
  $body.AddBezier(374, 248, 382, 251, 387, 258, 387, 267)
  $body.AddLine(387, 267, 387, 286)
  $body.AddLine(387, 286, 366, 286)
  $body.AddBezier(366, 286, 366, 271, 354, 259, 340, 259)
  $body.AddBezier(340, 259, 325, 259, 313, 271, 313, 286)
  $body.AddLine(313, 286, 258, 286)
  $body.AddBezier(258, 286, 258, 271, 247, 259, 232, 259)
  $body.AddBezier(232, 259, 217, 259, 205, 271, 205, 286)
  $body.AddLine(205, 286, 185, 286)
  $body.AddLine(185, 286, 185, 269)
  $body.AddBezier(185, 269, 185, 261, 190, 254, 198, 251)
  $body.CloseFigure()
  $graphics.FillPath([System.Drawing.Brushes]::White, $body)
  $graphics.DrawPath($carPen, $body)
  $graphics.FillEllipse([System.Drawing.Brushes]::White, 216, 270, 32, 32)
  $graphics.DrawEllipse($wheelPen, 216, 270, 32, 32)
  $graphics.FillEllipse([System.Drawing.Brushes]::White, 324, 270, 32, 32)
  $graphics.DrawEllipse($wheelPen, 324, 270, 32, 32)

  $path = Join-Path $iconsDir $filename
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $body.Dispose(); $roadPen.Dispose(); $dashPen.Dispose(); $carPen.Dispose(); $wheelPen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-PwaIcon 180 'xswift-180.png'
New-PwaIcon 192 'xswift-192.png'
New-PwaIcon 512 'xswift-512.png'
New-PwaIcon 512 'xswift-512-maskable.png' $true
