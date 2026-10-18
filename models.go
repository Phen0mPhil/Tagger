package main

import (
"crypto/sha256"
"encoding/hex"
"encoding/json"
"fmt"
"os"
"path/filepath"
"sort"
"strings"
"sync"
"sync/atomic"
)

type ImageEntry struct {
RelativePath string   `json:"relative_path"`
FileName     string   `json:"file_name"`
FileSize     int64    `json:"file_size"`
Tags         []string `json:"tags"`
}

type Catalog struct {
mu         sync.RWMutex
prewarming atomic.Bool
RootDir    string                 `json:"root_dir"`
Entries    map[string]*ImageEntry `json:"entries"`
}

type CatalogPool struct {
mu       sync.RWMutex
catalogs map[string]*Catalog
}

var globalPool = &CatalogPool{
catalogs: make(map[string]*Catalog),
}

func (p *CatalogPool) Get(dir string) *Catalog {
canonical := canonicalizePath(dir)
if canonical == "" {
return nil
}

p.mu.Lock()
defer p.mu.Unlock()

cat, exists := p.catalogs[canonical]
if !exists {
cat = &Catalog{
RootDir: canonical,
Entries: make(map[string]*ImageEntry),
}
_ = cat.LoadFromDisk()
p.catalogs[canonical] = cat
}
return cat
}

func (c *Catalog) SidecarPath() string {
return filepath.Join(c.RootDir, "catalog.json")
}

func (c *Catalog) LoadFromDisk() error {
c.mu.Lock()
defer c.mu.Unlock()

sidecar := c.SidecarPath()
data, err := os.ReadFile(sidecar)
if err != nil {
if os.IsNotExist(err) {
return nil
}
return err
}

diskData := struct {
Entries map[string]*ImageEntry `json:"entries"`
}{}

if err := json.Unmarshal(data, &diskData); err != nil {
return err
}

if diskData.Entries != nil {
for k, v := range diskData.Entries {
cleanKey := filepath.ToSlash(filepath.Clean(k))
cleanKey = strings.TrimPrefix(cleanKey, "./")
c.Entries[cleanKey] = v
}
}
return nil
}

func (c *Catalog) saveToDiskLocked() error {
sidecar := c.SidecarPath()
tmpSidecar := sidecar + ".tmp"

wrapper := struct {
RootDir string                 `json:"root_dir"`
Entries map[string]*ImageEntry `json:"entries"`
}{
RootDir: c.RootDir,
Entries: c.Entries,
}

data, err := json.MarshalIndent(wrapper, "", "  ")
if err != nil {
return err
}

f, err := os.OpenFile(tmpSidecar, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
if err != nil {
return err
}

if _, err := f.Write(data); err != nil {
_ = f.Close()
_ = os.Remove(tmpSidecar)
return err
}

if err := f.Sync(); err != nil {
_ = f.Close()
_ = os.Remove(tmpSidecar)
return err
}
_ = f.Close()

_ = os.Remove(sidecar)
return os.Rename(tmpSidecar, sidecar)
}

func (c *Catalog) AddTags(relPath string, tags []string) error {
return c.AddTagsBulk([]string{relPath}, tags)
}

func (c *Catalog) AddTagsBulk(relPaths []string, tags []string) error {
c.mu.Lock()
defer c.mu.Unlock()

cleanTags := make([]string, 0, len(tags))
for _, t := range tags {
clean := strings.ToLower(strings.TrimSpace(t))
if clean != "" {
cleanTags = append(cleanTags, clean)
}
}
if len(cleanTags) == 0 {
return nil
}

updated := false
for _, relPath := range relPaths {
cleanRel := filepath.ToSlash(filepath.Clean(relPath))
cleanRel = strings.TrimPrefix(cleanRel, "./")

entry, found := c.Entries[cleanRel]
if !found {
for k, v := range c.Entries {
if strings.EqualFold(k, cleanRel) {
entry = v
found = true
break
}
}
}
if !found {
continue
}

tagMap := make(map[string]bool, len(entry.Tags))
for _, t := range entry.Tags {
tagMap[strings.ToLower(strings.TrimSpace(t))] = true
}

for _, clean := range cleanTags {
if !tagMap[clean] {
entry.Tags = append(entry.Tags, clean)
tagMap[clean] = true
updated = true
}
}
sort.Strings(entry.Tags)
}

if !updated {
return nil
}
return c.saveToDiskLocked()
}

func (c *Catalog) RemoveTag(relPath string, tag string) error {
return c.RemoveTagsBulk([]string{relPath}, []string{tag})
}

func (c *Catalog) RemoveTagsBulk(relPaths []string, tags []string) error {
c.mu.Lock()
defer c.mu.Unlock()

targetTags := make(map[string]bool)
for _, t := range tags {
clean := strings.ToLower(strings.TrimSpace(t))
if clean != "" {
targetTags[clean] = true
}
}
if len(targetTags) == 0 {
return nil
}

updated := false
for _, rel := range relPaths {
cleanRel := filepath.ToSlash(filepath.Clean(rel))
cleanRel = strings.TrimPrefix(cleanRel, "./")

entry, found := c.Entries[cleanRel]
if !found {
for k, v := range c.Entries {
if strings.EqualFold(k, cleanRel) {
entry = v
found = true
break
}
}
}

if found {
newList := make([]string, 0, len(entry.Tags))
for _, t := range entry.Tags {
if !targetTags[strings.ToLower(strings.TrimSpace(t))] {
newList = append(newList, t)
}
}
if len(newList) != len(entry.Tags) {
entry.Tags = newList
updated = true
}
}
}

if !updated {
return nil
}
return c.saveToDiskLocked()
}

func (c *Catalog) MoveEntries(destTarget string, relativePaths []string) (int, string, []string, error) {
c.mu.Lock()
defer c.mu.Unlock()

var targetDirPath string
cleanTarget := cleanPathString(destTarget)

if filepath.IsAbs(cleanTarget) || (len(cleanTarget) >= 2 && cleanTarget[1] == ':') || strings.HasPrefix(cleanTarget, "/") {
targetDirPath = filepath.Clean(filepath.FromSlash(cleanTarget))
} else {
cleanSub := filepath.Clean(filepath.ToSlash(destTarget))
cleanSub = strings.Trim(cleanSub, "/\\.")
if destTarget == ".junk" {
cleanSub = ".junk"
}
if cleanSub == "" {
return 0, "", nil, fmt.Errorf("invalid destination target")
}
targetDirPath = filepath.Join(c.RootDir, cleanSub)
}

if err := os.MkdirAll(targetDirPath, 0755); err != nil {
return 0, "", nil, fmt.Errorf("failed to create destination: %w", err)
}

cacheDir := filepath.Join(c.RootDir, ".cache", "thumbnails")
movedCount := 0
movedPaths := make([]string, 0, len(relativePaths))

for _, rel := range relativePaths {
cleanRel := filepath.ToSlash(filepath.Clean(rel))
cleanRel = strings.TrimPrefix(cleanRel, "./")

srcPath := filepath.Join(c.RootDir, filepath.FromSlash(cleanRel))
_, err := os.Stat(srcPath)
if err != nil {
found := false
for k := range c.Entries {
if strings.EqualFold(k, cleanRel) {
cleanRel = k
srcPath = filepath.Join(c.RootDir, filepath.FromSlash(cleanRel))
_, err = os.Stat(srcPath)
found = (err == nil)
break
}
}
if !found {
continue
}
}

baseName := filepath.Base(srcPath)
if filepath.Clean(srcPath) == filepath.Clean(filepath.Join(targetDirPath, baseName)) {
continue
}

ext := filepath.Ext(baseName)
nameWithoutExt := strings.TrimSuffix(baseName, ext)

destFileName := baseName
destFilePath := filepath.Join(targetDirPath, destFileName)
collisionIdx := 1

for {
if _, err := os.Stat(destFilePath); os.IsNotExist(err) {
break
}
destFileName = fmt.Sprintf("%s_%d%s", nameWithoutExt, collisionIdx, ext)
destFilePath = filepath.Join(targetDirPath, destFileName)
collisionIdx++
}

_ = os.Remove(destFilePath)
if err := os.Rename(srcPath, destFilePath); err != nil {
continue
}

hash := sha256.Sum256([]byte(cleanRel))
cachedThumbPath := filepath.Join(cacheDir, hex.EncodeToString(hash[:16])+".jpg")
_ = os.Remove(cachedThumbPath)

delete(c.Entries, cleanRel)
movedPaths = append(movedPaths, destFileName)
movedCount++
}

resolvedDest := canonicalizePath(targetDirPath)
_ = c.saveToDiskLocked()
return movedCount, resolvedDest, movedPaths, nil
}
