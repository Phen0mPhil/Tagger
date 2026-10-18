//go:build !windows

package main

import "errors"

func pickFolderGUI() (string, error) {
return "", errors.New("GUI folder picker is only supported on Windows")
}
