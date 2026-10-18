package main

import (
"embed"
"fmt"
"io/fs"
"net"
"net/http"
"os"
"os/exec"
"path/filepath"
"runtime"
"time"
)

//go:embed web/*
var webFiles embed.FS

func main() {
mux := http.NewServeMux()

subFS, err := fs.Sub(webFiles, "web")
if err != nil {
panic(err)
}

fileServer := http.FileServer(http.FS(subFS))
mux.Handle("/", fileServer)

// REST API Routes
mux.HandleFunc("/api/pick-folder", handlePickFolder)
mux.HandleFunc("/api/browse", handleBrowseFolders)
mux.HandleFunc("/api/scan", handleScan)
mux.HandleFunc("/api/entries", handleEntries)
mux.HandleFunc("/api/tags/add", handleAddTags)
mux.HandleFunc("/api/tags/remove", handleRemoveTag)
mux.HandleFunc("/api/tags/remove-bulk", handleRemoveTagsBulk)
mux.HandleFunc("/api/files/move", handleMoveFiles)
mux.HandleFunc("/api/image", handleServeImage)
mux.HandleFunc("/api/thumbnail", handleServeThumbnail)
mux.HandleFunc("/api/gemini/run", handleGeminiRun)
mux.HandleFunc("/api/gemini/save", handleSaveGeminiArtifact)
mux.HandleFunc("/api/heartbeat", handleHeartbeat)
mux.HandleFunc("/api/client-close", handleClientClose)
mux.HandleFunc("/api/shutdown", handleShutdown)

port := 8080
addr := fmt.Sprintf(":%d", port)
url := fmt.Sprintf("http://localhost:%d", port)

// If an old instance is still holding port 8080, tell it to shut down and reclaim the port
ln, err := net.Listen("tcp", addr)
if err != nil {
client := &http.Client{Timeout: 500 * time.Millisecond}
_, _ = client.Post(url+"/api/shutdown", "application/json", nil)
for i := 0; i < 10; i++ {
time.Sleep(100 * time.Millisecond)
ln, err = net.Listen("tcp", addr)
if err == nil {
break
}
}
if err != nil {
// Another instance is still active; pop open the browser window to it and exit
openBrowser(url)
time.Sleep(500 * time.Millisecond)
return
}
}

go func() {
time.Sleep(250 * time.Millisecond)
openBrowser(url)
}()

handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
touchServerActivity()
mux.ServeHTTP(w, r)
})

server := &http.Server{
Handler: handler,
}

_ = server.Serve(ln)
}

func openBrowser(url string) {
var cmd *exec.Cmd
switch runtime.GOOS {
case "windows":
chromePaths := []string{
`C:\Program Files\Google\Chrome\Application\chrome.exe`,
`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
filepath.Join(os.Getenv("LOCALAPPDATA"), `Google\Chrome\Application\chrome.exe`),
}
var targetExe string
for _, p := range chromePaths {
if _, err := os.Stat(p); err == nil {
targetExe = p
break
}
}
if targetExe != "" {
cmd = exec.Command(targetExe, fmt.Sprintf("--app=%s", url), "--window-size=1600,1000", "--start-maximized")
} else {
cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
}
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
