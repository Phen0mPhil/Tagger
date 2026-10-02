package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os/exec"
	"runtime"
	"time"
)

//go:embed web/*
var webFiles embed.FS

func main() {
	mux := http.NewServeMux()

	// Sub-filesystem isolation so web/ is stripped from public URLs
	subFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		panic(err)
	}

	// Serve all HTML, CSS, and JS modular assets
	fileServer := http.FileServer(http.FS(subFS))
	mux.Handle("/", fileServer)

	// REST API Routes
	mux.HandleFunc("/api/pick-folder", handlePickFolder)
	mux.HandleFunc("/api/browse", handleBrowseFolders)
	mux.HandleFunc("/api/scan", handleScan)
	mux.HandleFunc("/api/entries", handleEntries)
	mux.HandleFunc("/api/tags/add", handleAddTags)
	mux.HandleFunc("/api/tags/remove", handleRemoveTag)
	mux.HandleFunc("/api/image", handleServeImage)
	mux.HandleFunc("/api/shutdown", handleShutdown)

	port := 8080
	url := fmt.Sprintf("http://localhost:%d", port)

	// Launch default browser once server spins up
	go func() {
		time.Sleep(350 * time.Millisecond)
		openBrowser(url)
	}()

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	_ = server.ListenAndServe()
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "linux":
		if isWSL() {
			cmd = exec.Command("cmd.exe", "/c", "start", url)
		} else {
			cmd = exec.Command("xdg-open", url)
		}
	case "darwin":
		cmd = exec.Command("open", url)
	}

	if cmd != nil {
		_ = cmd.Start()
	}
}

func isWSL() bool {
	_, err := exec.LookPath("wslpath")
	return err == nil
}
