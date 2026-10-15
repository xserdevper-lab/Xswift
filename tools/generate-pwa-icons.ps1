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

  $black = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(17, 17, 17))
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $bodyPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(17, 17, 17), 13)
  $bodyPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $wheelPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(17, 17, 17), 14)

  $speedLines = @(
    [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(62, 152), [System.Drawing.PointF]::new(192, 152), [System.Drawing.PointF]::new(174, 172), [System.Drawing.PointF]::new(62, 172)),
    [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(74, 190), [System.Drawing.PointF]::new(165, 190), [System.Drawing.PointF]::new(149, 209), [System.Drawing.PointF]::new(74, 209)),
    [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(86, 227), [System.Drawing.PointF]::new(135, 227), [System.Drawing.PointF]::new(123, 246), [System.Drawing.PointF]::new(86, 246))
  )
  foreach ($line in $speedLines) { $graphics.FillPolygon($black, $line) }

  $body = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $body.StartFigure()
  $body.AddLine(125, 294, 112, 281)
  $body.AddBezier(112, 281, 97, 266, 95, 242, 102, 220)
  $body.AddBezier(102, 220, 108, 205, 114, 199, 121, 193)
  $body.AddLine(121, 193, 177, 135)
  $body.AddBezier(177, 135, 198, 114, 224, 104, 254, 104)
  $body.AddLine(254, 104, 325, 104)
  $body.AddBezier(325, 104, 356, 104, 378, 116, 402, 137)
  $body.AddLine(402, 137, 436, 169)
  $body.AddBezier(436, 169, 447, 179, 459, 183, 471, 187)
  $body.AddBezier(471, 187, 484, 191, 492, 203, 492, 218)
  $body.AddLine(492, 218, 492, 239)
  $body.AddBezier(492, 239, 492, 258, 482, 275, 466, 286)
  $body.AddLine(466, 286, 443, 301)
  $body.AddBezier(443, 301, 438, 277, 418, 259, 394, 259)
  $body.AddBezier(394, 259, 367, 259, 348, 278, 343, 304)
  $body.AddLine(343, 304, 228, 304)
  $body.AddBezier(228, 304, 224, 278, 205, 259, 179, 259)
  $body.AddBezier(179, 259, 154, 259, 134, 278, 129, 304)
  $body.AddLine(129, 304, 125, 294)
  $body.CloseFigure()
  $graphics.FillPath($white, $body)
  $graphics.DrawPath($bodyPen, $body)

  foreach ($centerX in @(179, 394)) {
    $graphics.FillEllipse($white, $centerX - 39, 265, 78, 78)
    $graphics.DrawEllipse($wheelPen, $centerX - 39, 265, 78, 78)
  }

  $path = Join-Path $iconsDir $filename
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $body.Dispose(); $bodyPen.Dispose(); $wheelPen.Dispose(); $black.Dispose(); $white.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-PwaIcon 180 'xswift-180.png'
New-PwaIcon 192 'xswift-192.png'
New-PwaIcon 512 'xswift-512.png'
New-PwaIcon 512 'xswift-512-maskable.png' $true

