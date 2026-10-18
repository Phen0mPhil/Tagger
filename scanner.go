package main

import (
"encoding/json"
"io/fs"
"os"
"path/filepath"
"strings"
)

var validMediaExtensions = map[string]string{
".jpg":  "image",
".jpeg": "image",
".png":  "image",
".webp": "image",
".gif":  "image",
".bmp":  "image",
".mp4":  "video",
".mov":  "video",
".webm": "video",
".m4v":  "video",
}

func getMediaType(path string) string {
ext := strings.ToLower(filepath.Ext(path))
return validMediaExtensions[ext]
}

func isSupportedMedia(path string) bool {
return getMediaType(path) != ""
}

func shouldSkipDir(name string) bool {
lower := strings.ToLower(name)
if strings.HasPrefix(lower, ".") || strings.HasPrefix(lower, "$") {
return true
}
switch lower {
case "junk", "_junk", "trash", "_trash", "quarantine", "_quarantined":
return true
default:
return false
}
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
if shouldSkipDir(d.Name()) {
return filepath.SkipDir
}
if !recursive {
return filepath.SkipDir
}
dirSidecarCache[path] = loadDiskTagsForDir(path)
return nil
}

if !isSupportedMedia(d.Name()) {
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

if existing, ok := dirSidecarCache[c.RootDir][cleanRel]; ok && len(existing) > 0 {
entry.Tags = existing
} else {
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
