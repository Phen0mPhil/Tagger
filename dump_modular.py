import os
import shutil

TARGET_EXTENSIONS = {'.go', '.js', '.html', '.css'}
IGNORE_DIRS = {'.git', '.cache', 'bin', 'dist', 'node_modules', 'audit_dumps', 'tagger'}
OUTPUT_DIR = "/mnt/c/Users/Phil/Desktop/tagger/audit_dumps"

def dump_modular():
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    file_manifest = []

    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in TARGET_EXTENSIONS:
                src_path = os.path.join(root, file)
                
                norm_rel = os.path.normpath(src_path).replace(os.sep, '_').lstrip('._')
                out_filename = f"{norm_rel}.txt"
                dest_path = os.path.join(OUTPUT_DIR, out_filename)
                
                with open(src_path, 'r', encoding='utf-8', errors='ignore') as src, \
                     open(dest_path, 'w', encoding='utf-8') as dst:
                    dst.write(f"// FILE ORIGIN: {src_path}\n")
                    dst.write(f"// ======================================\n\n")
                    dst.write(src.read())

                file_manifest.append(f"{out_filename} -> (original: {src_path})")

    with open(os.path.join(OUTPUT_DIR, "_MANIFEST.txt"), 'w', encoding='utf-8') as f:
        f.write("\n".join(sorted(file_manifest)))

    print(f"Generated {len(file_manifest)} modular text dumps directly in Windows desktop path: '{OUTPUT_DIR}'")

if __name__ == "__main__":
    dump_modular()
