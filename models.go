package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type ImageEntry struct {
	RelativePath string   `json:"relative_path"`
	FileName     string   `json:"file_name"`
	FileSize     int64    `json:"file_size"`
	Tags         []string `json:"tags"`
}

type Catalog struct {
	mu      sync.RWMutex
	RootDir string                 `json:"root_dir"`
	Entries map[string]*ImageEntry `json:"entries"`
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

	return os.Rename(tmpSidecar, sidecar)
}

func (c *Catalog) SaveToDisk() error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.saveToDiskLocked()
}

func (c *Catalog) AddTags(relPath string, tags []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

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
		return fmt.Errorf("file not found: %s", relPath)
	}

	tagMap := make(map[string]bool)
	for _, t := range entry.Tags {
		tagMap[strings.ToLower(strings.TrimSpace(t))] = true
	}

	for _, t := range tags {
		clean := strings.ToLower(strings.TrimSpace(t))
		if clean != "" && !tagMap[clean] {
			entry.Tags = append(entry.Tags, clean)
			tagMap[clean] = true
		}
	}

	return c.saveToDiskLocked()
}

func (c *Catalog) RemoveTag(relPath string, tag string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

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
		return fmt.Errorf("file not found: %s", relPath)
	}

	target := strings.ToLower(strings.TrimSpace(tag))
	newList := make([]string, 0, len(entry.Tags))
	for _, t := range entry.Tags {
		if strings.ToLower(strings.TrimSpace(t)) != target {
			newList = append(newList, t)
		}
	}
	entry.Tags = newList

	return c.saveToDiskLocked()
}
