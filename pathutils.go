package main

import (
"path/filepath"
"strings"
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

isUnixAbs := strings.HasPrefix(clean, "/")
clean = filepath.ToSlash(filepath.Clean(filepath.FromSlash(clean)))

if len(clean) >= 2 && clean[1] == ':' {
clean = strings.ToLower(string(clean[0])) + clean[1:]
if len(clean) == 2 || clean == clean[:2]+"." {
return clean[:2] + "/"
}
if len(clean) == 3 && clean[2] == '/' {
return clean
}
}

if clean == "/" {
return "/"
}
res := strings.TrimRight(clean, "/")
if isUnixAbs && !strings.HasPrefix(res, "/") {
res = "/" + res
}
return res
}
