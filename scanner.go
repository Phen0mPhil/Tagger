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

func loadDiskTagsForDir(dirPath string) map[string][]string {
tags := make(map[string][]string)
sidecar := filepath.Join(dirPath, "catalog.json")
data, err := os.ReadFile(sidecar)
if err != nil {
return tags
}

var diskData struct {
Entries map[string]*ImageEntry `json:"entries"`
}
if err := json.Unmarshal(data, &diskData); err == nil && diskData.Entries != nil {
for k, v := range diskData.Entries {
cleanKey := filepath.ToSlash(filepath.Clean(k))
cleanKey = strings.TrimPrefix(cleanKey, "./")
tags[cleanKey] = v.Tags
}
}
return tags
}

func (c *Catalog) Scan(recursive bool) (int, error) {
c.mu.Lock()
defer c.mu.Unlock()

// Cache tag sidecars per directory to prevent repeated reads
dirSidecarCache := make(map[string]map[string][]string)
dirSidecarCache[c.RootDir] = loadDiskTagsForDir(c.RootDir)

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
// Preload sidecar tags for this subfolder
dirSidecarCache[path] = loadDiskTagsForDir(path)
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

// 1. Try finding tag in root catalog
if existing, ok := dirSidecarCache[c.RootDir][cleanRel]; ok && len(existing) > 0 {
entry.Tags = existing
} else {
// 2. Try finding tag in subfolder's own catalog.json
parentDir := filepath.Dir(path)
if subTags, exists := dirSidecarCache[parentDir]; exists {
subRel := filepath.ToSlash(filepath.Clean(d.Name()))
if foundTags, ok := subTags[subRel]; ok {
entry.Tags = foundTags
}
}
}

newEntries[cleanRel] = entry
discoveredCount++
return nil
})

c.Entries = newEntries
_ = c.saveToDiskLocked()

return discoveredCount, err
}
