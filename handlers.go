package main

import (
	"encoding/json"
	"fmt"
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

	normDir := resolveUniversalPath(rawDir)
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

	resolved := resolveUniversalPath(req.Path)
	info, err := os.Stat(resolved)
	if err != nil {
		http.Error(w, fmt.Sprintf("Directory does not exist: %s (%v)", resolved, err), http.StatusBadRequest)
		return
	}
	if !info.IsDir() {
		http.Error(w, "Path is not a directory", http.StatusBadRequest)
		return
	}

	globalCatalog.mu.Lock()
	globalCatalog.RootDir = resolved
	globalCatalog.mu.Unlock()

	discovered, scanErr := globalCatalog.Scan(req.Recursive)
	if scanErr != nil {
		http.Error(w, fmt.Sprintf("Scan error: %v", scanErr), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":     "ok",
		"discovered": discovered,
		"total":      len(globalCatalog.Entries),
		"root_dir":   resolved,
	})
}

func handleEntries(w http.ResponseWriter, r *http.Request) {
	globalCatalog.mu.RLock()
	defer globalCatalog.mu.RUnlock()

	list := make([]*ImageEntry, 0, len(globalCatalog.Entries))
	for _, entry := range globalCatalog.Entries {
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
		RelativePaths []string `json:"relative_paths"`
		Tags          []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	for _, rel := range req.RelativePaths {
		if err := globalCatalog.AddTags(rel, req.Tags); err != nil {
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
		RelativePath string `json:"relative_path"`
		Tag          string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if err := globalCatalog.RemoveTag(req.RelativePath, req.Tag); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleServeImage(w http.ResponseWriter, r *http.Request) {
	rawRel := r.URL.Query().Get("file")
	rel, err := url.QueryUnescape(rawRel)
	if err != nil {
		rel = rawRel
	}

	globalCatalog.mu.RLock()
	root := globalCatalog.RootDir
	globalCatalog.mu.RUnlock()

	fullPath := filepath.Join(root, filepath.FromSlash(rel))
	if !strings.HasPrefix(filepath.Clean(fullPath), filepath.Clean(root)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	http.ServeFile(w, r, fullPath)
}

func handleShutdown(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Shutting down..."))
	go func() {
		os.Exit(0)
	}()
}
