//go:build windows

package main

import (
"fmt"
"image"
"image/jpeg"
"os"
"path/filepath"
"runtime"
"syscall"
"unsafe"
)

var (
modShell32 = syscall.NewLazyDLL("shell32.dll")
modGdi32   = syscall.NewLazyDLL("gdi32.dll")
modOle32   = syscall.NewLazyDLL("ole32.dll")

procSHCreateItemFromParsingName = modShell32.NewProc("SHCreateItemFromParsingName")
procDeleteObject                = modGdi32.NewProc("DeleteObject")
procGetObject                   = modGdi32.NewProc("GetObjectW")
procGetDIBits                   = modGdi32.NewProc("GetDIBits")
procCreateCompatibleDC          = modGdi32.NewProc("CreateCompatibleDC")
procDeleteDC                    = modGdi32.NewProc("DeleteDC")
procCoInitializeEx              = modOle32.NewProc("CoInitializeEx")
procCoUninitialize              = modOle32.NewProc("CoUninitialize")
)

type guid struct {
Data1 uint32
Data2 uint16
Data3 uint16
Data4 [8]byte
}

var iidIShellItemImageFactory = guid{
Data1: 0xbcc18b79,
Data2: 0xba16,
Data3: 0x442f,
Data4: [8]byte{0x80, 0xc4, 0x8a, 0x59, 0xc3, 0x0c, 0x46, 0x3b},
}

type iShellItemImageFactoryVtbl struct {
QueryInterface uintptr
AddRef         uintptr
Release        uintptr
GetImage       uintptr
}

type iShellItemImageFactory struct {
LpVtbl *iShellItemImageFactoryVtbl
}

type bitmap struct {
Type       int32
Width      int32
Height     int32
WidthBytes int32
Planes     uint16
BitsPixel  uint16
Bits       uintptr
}

type bitmapinfoheader struct {
Size          uint32
Width         int32
Height        int32
Planes        uint16
BitCount      uint16
Compression   uint32
SizeImage     uint32
XPelsPerMeter int32
YPelsPerMeter int32
ClrUsed       uint32
ClrImportant  uint32
}

func extractVideoThumbnailNative(videoPath string, cachedThumbPath string) error {
runtime.LockOSThread()
defer runtime.UnlockOSThread()

procCoInitializeEx.Call(0, 2)
defer procCoUninitialize.Call()

absPath, err := filepath.Abs(filepath.FromSlash(videoPath))
if err != nil {
return err
}

utf16Path, err := syscall.UTF16PtrFromString(absPath)
if err != nil {
return err
}

var factory *iShellItemImageFactory
hr, _, _ := procSHCreateItemFromParsingName.Call(
uintptr(unsafe.Pointer(utf16Path)),
0,
uintptr(unsafe.Pointer(&iidIShellItemImageFactory)),
uintptr(unsafe.Pointer(&factory)),
)
if int32(hr) < 0 || factory == nil {
return fmt.Errorf("SHCreateItem failed: 0x%08x", hr)
}
defer syscall.SyscallN(factory.LpVtbl.Release, uintptr(unsafe.Pointer(factory)))

sizeVal := uint64(400) | (uint64(400) << 32)
var hBitmap uintptr
hr, _, _ = syscall.SyscallN(
factory.LpVtbl.GetImage,
uintptr(unsafe.Pointer(factory)),
uintptr(sizeVal),
0,
uintptr(unsafe.Pointer(&hBitmap)),
)
if int32(hr) < 0 || hBitmap == 0 {
return fmt.Errorf("GetImage failed: 0x%08x", hr)
}
defer procDeleteObject.Call(hBitmap)

var bm bitmap
procGetObject.Call(hBitmap, unsafe.Sizeof(bm), uintptr(unsafe.Pointer(&bm)))
if bm.Width <= 0 || bm.Height <= 0 {
return fmt.Errorf("invalid bitmap dimensions")
}

hdc, _, _ := procCreateCompatibleDC.Call(0)
if hdc == 0 {
return fmt.Errorf("CreateCompatibleDC failed")
}
defer procDeleteDC.Call(hdc)

var bi bitmapinfoheader
bi.Size = uint32(unsafe.Sizeof(bi))
bi.Width = bm.Width
bi.Height = -bm.Height // Top-down DIB
bi.Planes = 1
bi.BitCount = 32
bi.Compression = 0

rawBytes := make([]byte, bm.Width*bm.Height*4)
ret, _, _ := procGetDIBits.Call(
hdc,
hBitmap,
0,
uintptr(bm.Height),
uintptr(unsafe.Pointer(&rawBytes[0])),
uintptr(unsafe.Pointer(&bi)),
0,
)
if ret == 0 {
return fmt.Errorf("GetDIBits failed")
}

// Fast in-place BGRA to RGBA swap without per-pixel interface boxing
for i := 0; i < len(rawBytes); i += 4 {
rawBytes[i], rawBytes[i+2] = rawBytes[i+2], rawBytes[i]
rawBytes[i+3] = 255
}

img := &image.RGBA{
Pix:    rawBytes,
Stride: int(bm.Width) * 4,
Rect:   image.Rect(0, 0, int(bm.Width), int(bm.Height)),
}

tmpPath := cachedThumbPath + ".tmp"
f, err := os.Create(tmpPath)
if err != nil {
return err
}
if err := jpeg.Encode(f, img, &jpeg.Options{Quality: 82}); err != nil {
_ = f.Close()
_ = os.Remove(tmpPath)
return err
}
_ = f.Close()

_ = os.Remove(cachedThumbPath)
return os.Rename(tmpPath, cachedThumbPath)
}
