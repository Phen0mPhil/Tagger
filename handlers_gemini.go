package main

import (
"bytes"
"encoding/base64"
"encoding/json"
"fmt"
"image"
_ "image/gif"
"image/jpeg"
_ "image/png"
_ "golang.org/x/image/webp"
"io"
"net/http"
"os"
"path/filepath"
"strings"
"time"
)

var geminiHTTPClient = &http.Client{Timeout: 90 * time.Second}

type GeminiRunRequest struct {
Dir           string   `json:"dir"`
RelativePath  string   `json:"relative_path"`
RelativePaths []string `json:"relative_paths"`
Prompt        string   `json:"prompt"`
AspectRatio   string   `json:"aspect_ratio"`
Model         string   `json:"model"`
APIKey        string   `json:"api_key"`
}

type GeminiCandidateArtifact struct {
ID       string `json:"id"`
Data     string `json:"data"`
MimeType string `json:"mime_type"`
}

func getDownscaledBase64(srcPath string) (string, string, error) {
ext := strings.ToLower(filepath.Ext(srcPath))
mimeType := "image/jpeg"
switch ext {
case ".png":
mimeType = "image/png"
case ".webp":
mimeType = "image/webp"
case ".gif":
mimeType = "image/gif"
case ".mp4", ".mov", ".webm", ".m4v":
return "", "", fmt.Errorf("video analysis not supported via inline image bytes yet")
}

if f, err := os.Open(srcPath); err == nil {
img, _, decErr := image.Decode(f)
_ = f.Close()
if decErr == nil {
resized := downscaleImage(img, 1024)
var buf bytes.Buffer
if encErr := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 78}); encErr == nil {
return base64.StdEncoding.EncodeToString(buf.Bytes()), "image/jpeg", nil
}
}
}

bytesData, err := os.ReadFile(srcPath)
if err != nil {
return "", "", err
}
return base64.StdEncoding.EncodeToString(bytesData), mimeType, nil
}

func handleGeminiRun(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req GeminiRunRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload", http.StatusBadRequest)
return
}

dir := canonicalizePath(req.Dir)
paths := req.RelativePaths
if len(paths) == 0 && req.RelativePath != "" {
paths = []string{req.RelativePath}
}

if dir == "" || len(paths) == 0 || req.Prompt == "" {
http.Error(w, "Missing required parameters", http.StatusBadRequest)
return
}

activeKey := req.APIKey
if activeKey == "" {
activeKey = os.Getenv("GEMINI_API_KEY")
}
if activeKey == "" {
sendCandidateResponse(w, false, req.Model, nil, "", "No API Key configured. Please click Set Key in the header.", "")
return
}

targetModel := req.Model
if targetModel == "" {
targetModel = "gemini-3.1-flash-image"
}

var parts []map[string]any
for _, rawRel := range paths {
rel := cleanPathString(rawRel)
srcPath := filepath.Join(dir, filepath.FromSlash(rel))
// Secure Path Traversal Check
if relCheck, err := filepath.Rel(dir, srcPath); err != nil || strings.HasPrefix(relCheck, "..") {
sendCandidateResponse(w, false, targetModel, nil, "", "Access denied: invalid path traversal", "")
return
}

base64Data, mimeType, err := getDownscaledBase64(srcPath)
if err != nil {
sendCandidateResponse(w, false, targetModel, nil, "", "File read error ("+rel+"): "+err.Error(), "")
return
}
parts = append(parts, map[string]any{
"inlineData": map[string]string{"mimeType": mimeType, "data": base64Data},
})
}

promptText := req.Prompt
if strings.Contains(targetModel, "image") && req.AspectRatio != "" {
promptText = fmt.Sprintf("%s (Target aspect ratio: %s)", req.Prompt, req.AspectRatio)
}
parts = append(parts, map[string]any{"text": promptText})

payload := map[string]any{
"contents": []map[string]any{
{"parts": parts},
},
}
if strings.Contains(targetModel, "image") {
payload["generationConfig"] = map[string]any{
"responseModalities": []string{"TEXT", "IMAGE"},
}
}

jsonBytes, _ := json.Marshal(payload)
apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", targetModel, activeKey)

resp, err := geminiHTTPClient.Post(apiURL, "application/json", bytes.NewReader(jsonBytes))
if err != nil {
sendCandidateResponse(w, false, targetModel, nil, "", "Network timeout or failure: "+err.Error(), "")
return
}
defer resp.Body.Close()

respBody, err := io.ReadAll(resp.Body)
if err != nil {
sendCandidateResponse(w, false, targetModel, nil, "", "Failed reading API response buffer", "")
return
}

if resp.StatusCode != http.StatusOK {
var errData struct {
Error struct {
Message string `json:"message"`
} `json:"error"`
}
errMsg := fmt.Sprintf("API Error (HTTP %d)", resp.StatusCode)
if json.Unmarshal(respBody, &errData) == nil && errData.Error.Message != "" {
errMsg = errData.Error.Message
}
sendCandidateResponse(w, false, targetModel, nil, "", errMsg, string(respBody))
return
}

var parsed struct {
PromptFeedback struct {
BlockReason string `json:"blockReason"`
} `json:"promptFeedback"`
Candidates []struct {
FinishReason string `json:"finishReason"`
Content      struct {
Parts []struct {
Text       string `json:"text"`
InlineData *struct {
MimeType string `json:"mimeType"`
Data     string `json:"data"`
} `json:"inlineData"`
InlineDataSnake *struct {
MimeType string `json:"mime_type"`
Data     string `json:"data"`
} `json:"inline_data"`
} `json:"parts"`
} `json:"content"`
} `json:"candidates"`
}

if err := json.Unmarshal(respBody, &parsed); err != nil {
sendCandidateResponse(w, true, targetModel, nil, "", "", string(respBody))
return
}

var notice string
var candidateImages []GeminiCandidateArtifact
var textBuilder strings.Builder

if parsed.PromptFeedback.BlockReason != "" {
notice = "Prompt blocked by policy: " + parsed.PromptFeedback.BlockReason
} else if len(parsed.Candidates) == 0 {
notice = "No output candidates returned from API."
} else {
if fr := parsed.Candidates[0].FinishReason; fr != "" && fr != "STOP" {
notice = "Request halted (FinishReason: " + fr + ")."
}
for partIdx, part := range parsed.Candidates[0].Content.Parts {
if part.Text != "" {
if textBuilder.Len() > 0 {
textBuilder.WriteString("\n")
}
textBuilder.WriteString(part.Text)
}

b64Img := ""
mType := "image/png"
if part.InlineData != nil && part.InlineData.Data != "" {
b64Img = part.InlineData.Data
if part.InlineData.MimeType != "" {
mType = part.InlineData.MimeType
}
} else if part.InlineDataSnake != nil && part.InlineDataSnake.Data != "" {
b64Img = part.InlineDataSnake.Data
if part.InlineDataSnake.MimeType != "" {
mType = part.InlineDataSnake.MimeType
}
}

if b64Img != "" {
candidateImages = append(candidateImages, GeminiCandidateArtifact{
ID:       fmt.Sprintf("gen_%d_%d", time.Now().UnixNano(), partIdx),
Data:     b64Img,
MimeType: mType,
})
}
}
}

var rawPayload string
if len(candidateImages) == 0 && textBuilder.Len() == 0 && notice == "" {
var pretty bytes.Buffer
if json.Indent(&pretty, respBody, "", "  ") == nil {
rawPayload = pretty.String()
} else {
rawPayload = string(respBody)
}
}

sendCandidateResponse(w, true, targetModel, candidateImages, textBuilder.String(), notice, rawPayload)
}

func handleSaveGeminiArtifact(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

var req struct {
Dir          string `json:"dir"`
RelativePath string `json:"relative_path"`
Data         string `json:"data"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, "Invalid payload", http.StatusBadRequest)
return
}

dir := canonicalizePath(req.Dir)
rel := cleanPathString(req.RelativePath)
if dir == "" || rel == "" || req.Data == "" {
http.Error(w, "Missing required parameters", http.StatusBadRequest)
return
}

rawImg, err := base64.StdEncoding.DecodeString(req.Data)
if err != nil {
http.Error(w, "Artifact decode failed: "+err.Error(), http.StatusBadRequest)
return
}

origBase := strings.TrimSuffix(filepath.Base(rel), filepath.Ext(rel))
ver := 1
var genName, genRel, fullGenPath string
for {
genName = fmt.Sprintf("%s_ai_v%d.png", origBase, ver)
relDir := filepath.Dir(rel)
if relDir != "." && relDir != "/" && relDir != "\\" {
genRel = filepath.ToSlash(filepath.Join(relDir, genName))
} else {
genRel = genName
}


fullGenPath = filepath.Join(dir, filepath.FromSlash(genRel))

if relCheck, err := filepath.Rel(dir, fullGenPath); err != nil || strings.HasPrefix(relCheck, "..") {
http.Error(w, "Access denied: invalid save path traversal", http.StatusForbidden)
return
}

if _, statErr := os.Stat(fullGenPath); os.IsNotExist(statErr) {
break
}
ver++
}

if writeErr := os.WriteFile(fullGenPath, rawImg, 0644); writeErr != nil {
http.Error(w, "Failed saving artifact: "+writeErr.Error(), http.StatusInternalServerError)
return
}

cat := globalPool.Get(dir)
cat.mu.Lock()
cat.Entries[genRel] = &ImageEntry{
RelativePath: genRel,
FileName:     genName,
FileSize:     int64(len(rawImg)),
Tags:         []string{"ai-generated"},
}
_ = cat.saveToDiskLocked()
cat.mu.Unlock()

w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]any{
"status":        "ok",
"file_name":     genName,
"relative_path": genRel,
})
}

func sendCandidateResponse(w http.ResponseWriter, ok bool, model string, images []GeminiCandidateArtifact, text, notice, raw string) {
w.Header().Set("Content-Type", "application/json")
_ = json.NewEncoder(w).Encode(map[string]any{
"ok":         ok,
"model_used": model,
"images":     images,
"text":       text,
"notice":     notice,
"raw":        raw,
})
}
