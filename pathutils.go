package main

import (
	"bytes"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
)

func cleanPathString(p string) string {
	p = strings.TrimPrefix(p, "\xef\xbb\xbf")
	p = strings.TrimPrefix(p, "\ufeff")
	return strings.TrimSpace(p)
}

func resolveUniversalPath(input string) string {
	clean := cleanPathString(input)
	if clean == "" {
		return ""
	}

	clean = strings.ReplaceAll(clean, "\\", "/")

	if runtime.GOOS == "windows" {
		return clean
	}

	// WSL translations
	if len(clean) >= 2 && clean[1] == ':' {
		letter := strings.ToLower(string(clean[0]))
		rest := strings.TrimPrefix(clean[2:], "/")
		return "/mnt/" + letter + "/" + rest
	}

	return clean
}

func pickFolderGUI() (string, error) {
	if runtime.GOOS != "windows" && os.Getenv("WSL_DISTRO_NAME") == "" {
		return "", nil
	}

	psScript := `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Select Image Directory"
$f.ShowNewFolderButton = $true

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.StartPosition = "CenterScreen"
$form.WindowState = "Minimized"
$form.Show()
$form.Activate()
$form.BringToFront()

$result = $f.ShowDialog($form)
$form.Dispose()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}
`
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", psScript)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return "", nil
	}

	return cleanPathString(out.String()), nil
}
