package main

import (
"encoding/json"
"fmt"
"net/http"
"os"
"path/filepath"
"sort"
"strings"
"sync"
"time"
)

type BrowseFolder struct {
Name string `json:"name"`
Path string `json:"path"`
}

type BrowseResponse struct {
CurrentPath string         `json:"current_path"`
ParentPath  string         `json:"parent_path"`
Subfolders  []BrowseFolder `json:"subfolders"`
}

func handleBrowseFolders(w http.ResponseWriter, r *http.Request) {
rawDir := r.URL.Query().Get("dir")
if rawDir == "" {
http.Error(w, "dir query parameter is required", http.StatusBadRequest)
return
}

normDir := canonicalizePath(rawDir)
info, err := os.Stat(normDir)
if err != nil || !info.IsDir() {
http.Error(w, fmt.Sprintf("invalid directory: %v", err), http.StatusBadRequest)
return
}

entries, err := os.ReadDir(normDir)
if err != nil {
http.Error(w, fmt.Sprintf("failed to read directory: %v", err), http.StatusInternalServerError)
return
}

subfolders := make([]BrowseFolder, 0)
for _, entry := range entries {
if entry.IsDir() {
name := entry.Name()
if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "$") {
continue
}
subfolders = append(subfolders, BrowseFolder{
Name: name,
Path: filepath.ToSlash(filepath.Join(normDir, name)),
})
}
}

sort.Slice(subfolders, func(i, j int) bool {
return strings.ToLower(subfolders[i].Name) < strings.ToLower(subfolders[j].Name)
})

parent := filepath.Dir(normDir)
if parent == normDir {
parent = ""
} else {
parent = filepath.ToSlash(parent)
}

resp := BrowseResponse{
CurrentPath: filepath.ToSlash(normDir),
ParentPath:  parent,
Subfolders:  subfolders,
}

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(resp)
}

func handlePickFolder(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

selected, err := pickFolderGUI()
if err != nil {
http.Error(w, fmt.Sprintf("Picker error: %v", err), http.StatusInternalServerError)
return
}

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]string{
"path": selected,
})
}

func handleScan(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req struct {
Path      string `json:"path"`
Recursive bool   `json:"recursive"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload", http.StatusBadRequest)
return
}

canonical := canonicalizePath(req.Path)
info, err := os.Stat(canonical)
if err != nil || !info.IsDir() {
http.Error(w, "Path is not a valid directory", http.StatusBadRequest)
return
}

cat := globalPool.Get(canonical)
discovered, scanErr := cat.Scan(req.Recursive)
if scanErr != nil {
http.Error(w, fmt.Sprintf("Scan error: %v", scanErr), http.StatusInternalServerError)
return
}

go prewarmThumbnails(cat)

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]any{
"status":     "ok",
"discovered": discovered,
"total":      len(cat.Entries),
"root_dir":   canonical,
})
}

func handleEntries(w http.ResponseWriter, r *http.Request) {
dir := canonicalizePath(r.URL.Query().Get("dir"))
if dir == "" {
http.Error(w, "dir parameter is required", http.StatusBadRequest)
return
}

cat := globalPool.Get(dir)
cat.mu.RLock()
list := make([]*ImageEntry, 0, len(cat.Entries))
for _, entry := range cat.Entries {
list = append(list, entry)
}
cat.mu.RUnlock()

sort.Slice(list, func(i, j int) bool {
return strings.ToLower(list[i].RelativePath) < strings.ToLower(list[j].RelativePath)
})

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(list)
}

func handleAddTags(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req struct {
Dir           string   `json:"dir"`
RelativePaths []string `json:"relative_paths"`
Tags          []string `json:"tags"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload", http.StatusBadRequest)
return
}

cat := globalPool.Get(req.Dir)
if cat == nil {
http.Error(w, "Invalid dir", http.StatusBadRequest)
return
}

if err := cat.AddTagsBulk(req.RelativePaths, req.Tags); err != nil {
http.Error(w, err.Error(), http.StatusInternalServerError)
return
}

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleRemoveTag(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req struct {
Dir          string `json:"dir"`
RelativePath string `json:"relative_path"`
Tag          string `json:"tag"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload", http.StatusBadRequest)
return
}

cat := globalPool.Get(req.Dir)
if cat == nil {
http.Error(w, "Invalid dir", http.StatusBadRequest)
return
}

if err := cat.RemoveTag(req.RelativePath, req.Tag); err != nil {
http.Error(w, err.Error(), http.StatusInternalServerError)
return
}

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleMoveFiles(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req struct {
Dir           string   `json:"dir"`
DestSubfolder string   `json:"dest_subfolder"`
RelativePaths []string `json:"relative_paths"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload: "+err.Error(), http.StatusBadRequest)
return
}

if req.Dir == "" || req.DestSubfolder == "" || len(req.RelativePaths) == 0 {
http.Error(w, "Missing required parameters", http.StatusBadRequest)
return
}

canonical := canonicalizePath(req.Dir)
cat := globalPool.Get(canonical)
if cat == nil {
http.Error(w, "Invalid directory: "+canonical, http.StatusBadRequest)
return
}

movedCount, resolvedDestDir, movedPaths, err := cat.MoveEntries(req.DestSubfolder, req.RelativePaths)
if err == nil && resolvedDestDir != "" {
	globalPool.mu.Lock()
	delete(globalPool.catalogs, resolvedDestDir)
	globalPool.mu.Unlock()
}
if err != nil {
http.Error(w, fmt.Sprintf("Move error: %v", err), http.StatusInternalServerError)
return
}

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]any{
"status":      "ok",
"moved":       movedCount,
"dest_dir":    resolvedDestDir,
"moved_paths": movedPaths,
})
}

var (
lastHeartbeat     = time.Now()
heartbeatMutex    sync.Mutex
heartbeatInitOnce sync.Once
)

func startHeartbeatMonitor() {
go func() {
for {
time.Sleep(5 * time.Second)
heartbeatMutex.Lock()
elapsed := time.Since(lastHeartbeat)
heartbeatMutex.Unlock()

if elapsed > 60*time.Second {
os.Exit(0)
}
}
}()
}

func handleHeartbeat(w http.ResponseWriter, r *http.Request) {
heartbeatInitOnce.Do(startHeartbeatMonitor)
heartbeatMutex.Lock()
lastHeartbeat = time.Now()
heartbeatMutex.Unlock()
w.WriteHeader(http.StatusOK)
_, _ = w.Write([]byte("ok"))
}

func handleShutdown(w http.ResponseWriter, r *http.Request) {
w.WriteHeader(http.StatusOK)
_, _ = w.Write([]byte("Shutting down..."))
go func() {
time.Sleep(100 * time.Millisecond)
os.Exit(0)
}()
}

func handleRemoveTagsBulk(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req struct {
Dir           string   `json:"dir"`
RelativePaths []string `json:"relative_paths"`
Tags          []string `json:"tags"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload", http.StatusBadRequest)
return
}

cat := globalPool.Get(req.Dir)
if cat == nil {
http.Error(w, "Invalid dir", http.StatusBadRequest)
return
}

if err := cat.RemoveTagsBulk(req.RelativePaths, req.Tags); err != nil {
http.Error(w, err.Error(), http.StatusInternalServerError)
return
}

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
