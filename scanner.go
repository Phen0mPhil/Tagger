package main

import (
"encoding/json"
"io/fs"
"os"
"path/filepath"
"strings"
)

var validImageExtensions = map[string]bool{
".jpg":  true,
".jpeg": true,
".png":  true,
".webp": true,
".gif":  true,
".bmp":  true,
}

func isImageFile(path string) bool {
ext := strings.ToLower(filepath.Ext(path))
return validImageExtensions[ext]
}

func (c *Catalog) Scan(recursive bool) (int, error) {
c.mu.Lock()
defer c.mu.Unlock()

diskTags := make(map[string][]string)
sidecar := c.SidecarPath()
if data, err := os.ReadFile(sidecar); err == nil {
var diskData struct {
Entries map[string]*ImageEntry `json:"entries"`
}
if jsonErr := json.Unmarshal(data, &diskData); jsonErr == nil && diskData.Entries != nil {
for k, v := range diskData.Entries {
cleanKey := filepath.ToSlash(filepath.Clean(k))
cleanKey = strings.TrimPrefix(cleanKey, "./")
diskTags[cleanKey] = v.Tags
}
}
}

newEntries := make(map[string]*ImageEntry)
discoveredCount := 0

err := filepath.WalkDir(c.RootDir, func(path string, d fs.DirEntry, err error) error {
if err != nil {
return nil
}

if d.IsDir() {
if path == c.RootDir {
return nil
}
if strings.HasPrefix(d.Name(), ".") || strings.HasPrefix(d.Name(), "$") {
return filepath.SkipDir
}
if !recursive {
return filepath.SkipDir
}
return nil
}

if !isImageFile(d.Name()) {
return nil
}

relPath, relErr := filepath.Rel(c.RootDir, path)
if relErr != nil {
return nil
}

cleanRel := filepath.ToSlash(filepath.Clean(relPath))
cleanRel = strings.TrimPrefix(cleanRel, "./")

info, infoErr := d.Info()
var size int64 = 0
if infoErr == nil {
size = info.Size()
}

entry := &ImageEntry{
RelativePath: cleanRel,
FileName:     d.Name(),
FileSize:     size,
Tags:         []string{},
}

if existing, ok := diskTags[cleanRel]; ok {
entry.Tags = existing
}

newEntries[cleanRel] = entry
discoveredCount++
return nil
})

c.Entries = newEntries
_ = c.saveToDiskLocked()

return discoveredCount, err
}
