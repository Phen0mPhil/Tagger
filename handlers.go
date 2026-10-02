package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
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
	defer cat.mu.RUnlock()

	list := make([]*ImageEntry, 0, len(cat.Entries))
	for _, entry := range cat.Entries {
		list = append(list, entry)
	}

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

	for _, rel := range req.RelativePaths {
		if err := cat.AddTags(rel, req.Tags); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
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
	if !strings.HasPrefix(filepath.Clean(fullPath), filepath.Clean(cat.RootDir)) {
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
	if !strings.HasPrefix(filepath.Clean(srcPath), filepath.Clean(cat.RootDir)) {
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

	file, err := os.Open(srcPath)
	if err != nil {
		http.ServeFile(w, r, srcPath)
		return
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		http.ServeFile(w, r, srcPath)
		return
	}

	resized := downscaleImage(img, 800)
	tmpPath := cachedPath + ".tmp"
	out, err := os.Create(tmpPath)
	if err != nil {
		http.ServeFile(w, r, srcPath)
		return
	}

	_ = jpeg.Encode(out, resized, &jpeg.Options{Quality: 82})
	_ = out.Close()
	_ = os.Rename(tmpPath, cachedPath)

	http.ServeFile(w, r, cachedPath)
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
	xRatio := (w << 16) / newW
	yRatio := (h << 16) / newH

	for y := 0; y < newH; y++ {
		srcY := ((y * yRatio) >> 16) + b.Min.Y
		for x := 0; x < newW; x++ {
			srcX := ((x * xRatio) >> 16) + b.Min.X
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}
	return dst
}

func handleShutdown(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Shutting down..."))
	go func() {
		os.Exit(0)
	}()
}
