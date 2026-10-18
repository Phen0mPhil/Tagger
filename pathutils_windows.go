//go:build windows

package main

import (
"bytes"
"errors"
"os/exec"
"syscall"
)

func pickFolderGUI() (string, error) {
psScript := `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
  }
"@

$owner = New-Object System.Windows.Forms.NativeWindow
$owner.AssignHandle([Win32]::GetForegroundWindow())

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select Photo/Video Directory"
$dialog.ShowNewFolderButton = $true

if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Write($dialog.SelectedPath)
}
$owner.ReleaseHandle()
`
cmd := exec.Command("powershell", "-NoProfile", "-Sta", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", psScript)
cmd.SysProcAttr = &syscall.SysProcAttr{
HideWindow:    true,
CreationFlags: 0x08000000,
}

var out bytes.Buffer
var errOut bytes.Buffer
cmd.Stdout = &out
cmd.Stderr = &errOut

if err := cmd.Run(); err != nil {
return "", errors.New(errOut.String() + " | " + err.Error())
}

return cleanPathString(out.String()), nil
}
