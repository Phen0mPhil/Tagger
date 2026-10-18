//go:build !windows

package main

import "errors"

func extractVideoThumbnailNative(videoPath string, cachedThumbPath string) error {
return errors.New("native video thumbnailing is only supported on Windows")
}
