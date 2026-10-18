package main

import (
"crypto/sha256"
"encoding/hex"
"image"
_ "image/gif"
"image/jpeg"
_ "image/png"
"net/http"
"net/url"
"os"
"path/filepath"
"strings"
"sync"

"golang.org/x/image/draw"
_ "golang.org/x/image/webp"
)

var thumbMu sync.Mutex

func handleServeImage(w http.ResponseWriter, r *http.Request) {
dir := canonicalizePath(r.URL.Query().Get("dir"))
rawRel := r.URL.Query().Get("file")
rel, err := url.QueryUnescape(rawRel)
if err != nil {
rel = rawRel
}

cat := globalPool.Get(dir)
if cat == nil {
http.Error(w, "Directory not found", http.StatusBadRequest)
return
}

fullPath := filepath.Join(cat.RootDir, filepath.FromSlash(rel))

if relCheck, err := filepath.Rel(cat.RootDir, fullPath); err != nil || strings.HasPrefix(relCheck, "..") {
http.Error(w, "Access denied", http.StatusForbidden)
return
}

http.ServeFile(w, r, fullPath)
}

func handleServeThumbnail(w http.ResponseWriter, r *http.Request) {
dir := canonicalizePath(r.URL.Query().Get("dir"))
rawRel := r.URL.Query().Get("file")
rel, err := url.QueryUnescape(rawRel)
if err != nil {
rel = rawRel
}

cat := globalPool.Get(dir)
if cat == nil {
http.Error(w, "Directory not found", http.StatusBadRequest)
return
}

srcPath := filepath.Join(cat.RootDir, filepath.FromSlash(rel))

if relCheck, err := filepath.Rel(cat.RootDir, srcPath); err != nil || strings.HasPrefix(relCheck, "..") {
http.Error(w, "Access denied", http.StatusForbidden)
return
}

cacheDir := filepath.Join(cat.RootDir, ".cache", "thumbnails")
_ = os.MkdirAll(cacheDir, 0755)

hash := sha256.Sum256([]byte(rel))
thumbName := hex.EncodeToString(hash[:16]) + ".jpg"
cachedPath := filepath.Join(cacheDir, thumbName)

if info, err := os.Stat(cachedPath); err == nil && info.Size() > 0 {
http.ServeFile(w, r, cachedPath)
return
}

if getMediaType(srcPath) == "video" {
thumbMu.Lock()
err := extractVideoThumbnailNative(srcPath, cachedPath)
thumbMu.Unlock()

if err == nil {
if info, statErr := os.Stat(cachedPath); statErr == nil && info.Size() > 0 {
http.ServeFile(w, r, cachedPath)
return
}
}

svg := `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<rect width="100%" height="100%" fill="#09090b"/>
<circle cx="150" cy="150" r="48" fill="#18181b" stroke="#38bdf8" stroke-width="3"/>
<polygon points="140,132 172,150 140,168" fill="#38bdf8"/>
<text x="150" y="225" font-family="monospace" font-size="14" font-weight="bold" fill="#71717a" text-anchor="middle">VIDEO</text>
</svg>`
w.Header().Set("Content-Type", "image/svg+xml")
_, _ = w.Write([]byte(svg))
return
}

if err := generateAndCacheImageThumb(srcPath, cachedPath); err != nil {
http.ServeFile(w, r, srcPath)
return
}

http.ServeFile(w, r, cachedPath)
}

func generateAndCacheImageThumb(srcPath, cachedPath string) error {
file, err := os.Open(srcPath)
if err != nil {
return err
}
img, _, err := image.Decode(file)
_ = file.Close()
if err != nil {
return err
}

resized := downscaleImage(img, 600)
tmpPath := cachedPath + ".tmp"
out, err := os.Create(tmpPath)
if err != nil {
return err
}

if err := jpeg.Encode(out, resized, &jpeg.Options{Quality: 82}); err != nil {
_ = out.Close()
_ = os.Remove(tmpPath)
return err
}
_ = out.Close()
return os.Rename(tmpPath, cachedPath)
}

func prewarmThumbnails(cat *Catalog) {
if !cat.prewarming.CompareAndSwap(false, true) {
return
}
defer cat.prewarming.Store(false)

cacheDir := filepath.Join(cat.RootDir, ".cache", "thumbnails")
_ = os.MkdirAll(cacheDir, 0755)

cat.mu.RLock()
relPaths := make([]string, 0, len(cat.Entries))
for rel := range cat.Entries {
relPaths = append(relPaths, rel)
}
cat.mu.RUnlock()

jobs := make(chan string, len(relPaths))
var wg sync.WaitGroup

for i := 0; i < 4; i++ {
wg.Add(1)
go func() {
defer wg.Done()
for rel := range jobs {
hash := sha256.Sum256([]byte(rel))
thumbName := hex.EncodeToString(hash[:16]) + ".jpg"
cachedPath := filepath.Join(cacheDir, thumbName)

if info, err := os.Stat(cachedPath); err == nil && info.Size() > 0 {
continue
}

srcPath := filepath.Join(cat.RootDir, filepath.FromSlash(rel))
if getMediaType(srcPath) == "video" {
thumbMu.Lock()
_ = extractVideoThumbnailNative(srcPath, cachedPath)
thumbMu.Unlock()
} else {
_ = generateAndCacheImageThumb(srcPath, cachedPath)
}
}
}()
}

for _, rel := range relPaths {
jobs <- rel
}
close(jobs)
wg.Wait()
}

func downscaleImage(src image.Image, maxEdge int) image.Image {
b := src.Bounds()
w, h := b.Dx(), b.Dy()

if w <= maxEdge && h <= maxEdge {
return src
}

var newW, newH int
if w > h {
newW = maxEdge
newH = (h * maxEdge) / w
} else {
newH = maxEdge
newW = (w * maxEdge) / h
}

if newW < 1 {
newW = 1
}
if newH < 1 {
newH = 1
}

dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
return dst
}
