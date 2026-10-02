package main

import (
"bytes"
"os/exec"
"path/filepath"
"strings"
"syscall"
)

func cleanPathString(p string) string {
p = strings.TrimPrefix(p, "\xef\xbb\xbf")
p = strings.TrimPrefix(p, "\ufeff")
return strings.TrimSpace(p)
}

func canonicalizePath(input string) string {
clean := cleanPathString(input)
if clean == "" {
return ""
}

clean = filepath.ToSlash(filepath.Clean(clean))

if len(clean) >= 2 && clean[1] == ':' {
clean = strings.ToLower(string(clean[0])) + clean[1:]
}

return strings.TrimRight(clean, "/")
}

func pickFolderGUI() (string, error) {
psScript := `
$app = New-Object -ComObject Shell.Application
$folder = $app.BrowseForFolder(0, "Select Photo Directory", 0x0011, 0)
if ($folder) {
    [Console]::Write($folder.Self.Path)
}
`
cmd := exec.Command("powershell", "-NoProfile", "-Sta", "-NonInteractive", "-Command", psScript)
cmd.SysProcAttr = &syscall.SysProcAttr{
CreationFlags: 0x08000000,
}

var out bytes.Buffer
cmd.Stdout = &out
err := cmd.Run()
if err != nil {
return "", err
}

return cleanPathString(out.String()), nil
}
