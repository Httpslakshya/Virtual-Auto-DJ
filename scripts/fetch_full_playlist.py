import os
import sys
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

PLAYLIST_URL = "https://www.youtube.com/watch?v=2JzQhcSc2pM&list=PLcegabezDO5E"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp_raw")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
SRC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SRC_DATA_DIR, exist_ok=True)

# 1. Fetch entire playlist track metadata using yt-dlp
print("Fetching full track list from YouTube playlist PLcegabezDO5E...")
cmd = [
    "yt-dlp",
    "--flat-playlist",
    "--print", "%(id)s\t%(title)s\t%(duration)s\t%(channel)s",
    PLAYLIST_URL
]
res = subprocess.run(cmd, capture_output=True, text=True, check=True)

raw_tracks = []
for line in res.stdout.strip().split("\n"):
    if not line.strip():
        continue
    parts = line.split("\t")
    if len(parts) >= 2:
        t_id = parts[0].strip()
        t_title = parts[1].strip()
        t_dur = float(parts[2].strip()) if len(parts) > 2 and parts[2].strip().replace('.', '', 1).isdigit() else 180.0
        t_channel = parts[3].strip() if len(parts) > 3 else "Artist"
        raw_tracks.append({
            "id": t_id,
            "title": t_title,
            "duration": t_dur,
            "artist": t_channel
        })

print(f"Discovered {len(raw_tracks)} tracks in playlist.")

def clean_title(title):
    # Strip common music video tags
    t = title
    for tag in ["(Official Video)", "[Official Video]", "(Official Music Video)", "[Official Music Video]", 
                "(Official Visualizer)", "[Official Visualizer]", "(Visualizer)", "- LYRIC VIDEO", 
                "| Official Video |", "(Studio Version)", "(STUDIO VERSION)", "| LEGACY |"]:
        t = t.replace(tag, "")
    return t.strip(" |-:—")

# Helper to process single track
def process_track(track_info):
    track_id = track_info["id"]
    raw_path = os.path.join(TEMP_DIR, f"{track_id}.webm")
    processed_path = os.path.join(OUTPUT_DIR, f"{track_id}.mp3")
    url = f"https://www.youtube.com/watch?v={track_id}"

    if os.path.exists(processed_path) and os.path.getsize(processed_path) > 100000:
        print(f"  [OK] Already downloaded: {track_info['title']}")
    else:
        print(f"  [DL] Downloading {track_info['title']} ({track_id})...")
        dl_cmd = [
            "yt-dlp",
            "-f", "bestaudio",
            "--no-playlist",
            "-o", raw_path,
            url
        ]
        r = subprocess.run(dl_cmd, capture_output=True, text=True)
        if r.returncode != 0:
            dl_cmd = ["yt-dlp", "--no-playlist", "-o", raw_path, url]
            subprocess.run(dl_cmd, capture_output=True, text=True)

        # Master & Normalize with ffmpeg (-14 LUFS, True Peak -1.5 dBFS, 30Hz high-pass, treble clarity)
        if os.path.exists(raw_path):
            ff_cmd = [
                "ffmpeg", "-y",
                "-i", raw_path,
                "-af", "highpass=f=30,treble=g=1.5:f=8000,loudnorm=I=-14:TP=-1.5:LRA=11",
                "-b:a", "320k",
                processed_path
            ]
            subprocess.run(ff_cmd, capture_output=True, text=True)
            try:
                os.remove(raw_path)
            except Exception:
                pass
            print(f"  [OK] Processed & Mastered: {track_info['title']}")
        else:
            print(f"  [FAIL] Failed downloading: {track_info['title']}")
            return None

    # Probe duration
    dur = track_info["duration"]
    try:
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", processed_path
        ], capture_output=True, text=True)
        if probe.returncode == 0 and probe.stdout.strip():
            dur = round(float(probe.stdout.strip()), 2)
    except Exception:
        pass

    return {
        "id": track_id,
        "title": clean_title(track_info["title"]),
        "artist": track_info["artist"],
        "audioUrl": f"/audio/{track_id}.mp3",
        "duration": dur,
        "artwork": f"https://img.youtube.com/vi/{track_id}/hqdefault.jpg",
        "youtubeUrl": url,
        "bpm": 130.0, # will be populated in analysis
        "firstBeat": 0.5,
        "beatInterval": 0.46
    }

# Process in parallel pool with 4 workers
results = []
with ThreadPoolExecutor(max_workers=4) as executor:
    future_to_track = {executor.submit(process_track, t): t for t in raw_tracks}
    for future in as_completed(future_to_track):
        res_item = future.result()
        if res_item:
            results.append(res_item)

# Sort results to match raw_tracks order
id_order = {t["id"]: i for i, t in enumerate(raw_tracks)}
results.sort(key=lambda x: id_order.get(x["id"], 999))

print(f"\nSuccessfully downloaded and mastered {len(results)} of {len(raw_tracks)} tracks.")

playlist_payload = {
    "playlistTitle": "Desi Hip-Hop Extended Mix (39 Tracks)",
    "targetUrl": PLAYLIST_URL,
    "tracks": results,
    "bpmOptimizedOrder": [t["id"] for t in results]
}

with open(os.path.join(DATA_DIR, "playlist.json"), "w", encoding="utf-8") as f:
    json.dump(playlist_payload, f, indent=2)

with open(os.path.join(SRC_DATA_DIR, "playlist.json"), "w", encoding="utf-8") as f:
    json.dump(playlist_payload, f, indent=2)

print("Saved playlist.json to public/ and src/data/.")
