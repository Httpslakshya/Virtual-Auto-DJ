import os
import json
import subprocess

TARGET_TRACKS = [
    {"id": "H6H39VUGYYw", "title": "PANCAKE", "artist": "Seedhe Maut x Hurricane"},
    {"id": "CgK2iGxNy7M", "title": "Madira", "artist": "Seedhe Maut"},
    {"id": "XCIYHCXQoxQ", "title": "RED", "artist": "Seedhe Maut"},
    {"id": "VEQ-XJWiQMM", "title": "11K", "artist": "Seedhe Maut"},
    {"id": "y-PF51nSwFI", "title": "Teen Dost", "artist": "Seedhe Maut x Sez on the Beat"},
    {"id": "i6GYhNg-Xkk", "title": "Terey Papa", "artist": "OG Lucifer x CALM"},
    {"id": "AZNwQuklrok", "title": "Dalli", "artist": "Bhaskar ft. Encore ABJ"},
    {"id": "7pNo-geT_MA", "title": "Brand New", "artist": "Seedhe Maut"},
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp_raw")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

processed_tracks = []

for i, track in enumerate(TARGET_TRACKS):
    track_id = track["id"]
    url = f"https://www.youtube.com/watch?v={track_id}"
    raw_path = os.path.join(TEMP_DIR, f"{track_id}.webm")
    processed_path = os.path.join(OUTPUT_DIR, f"{track_id}.mp3")
    
    print(f"\n[{i+1}/{len(TARGET_TRACKS)}] Downloading & Processing: {track['title']} ({track_id})...")
    
    # 1. Download best audio
    if not os.path.exists(processed_path):
        dl_cmd = [
            "yt-dlp",
            "-f", "bestaudio",
            "--no-playlist",
            "-o", raw_path,
            url
        ]
        res = subprocess.run(dl_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Failed to download {track_id}: {res.stderr}")
            # Try fallback without -f bestaudio
            dl_cmd = ["yt-dlp", "--no-playlist", "-o", raw_path, url]
            subprocess.run(dl_cmd)
        
        # 2. Process with ffmpeg:
        # - Highpass at 30Hz to remove inaudible sub-bass rumble
        # - Treble boost (+1.5dB @ 8kHz) for modern vocal clarity
        # - EBU R128 loudness normalization (-14 LUFS, True Peak -1.5 dBFS)
        # - Output high-bitrate 320k MP3
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", raw_path,
            "-af", "highpass=f=30,treble=g=1.5:f=8000,loudnorm=I=-14:TP=-1.5:LRA=11",
            "-b:a", "320k",
            processed_path
        ]
        res_ff = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if res_ff.returncode != 0:
            print(f"FFmpeg processing failed for {track_id}: {res_ff.stderr}")
        else:
            print(f"Successfully processed & normalized: {processed_path}")
            
        # Clean temp raw
        if os.path.exists(raw_path):
            try:
                os.remove(raw_path)
            except Exception:
                pass
    else:
        print(f"Already processed: {processed_path}")

    # Extract duration using ffprobe
    duration = 180.0
    try:
        probe_cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            processed_path
        ]
        dur_res = subprocess.run(probe_cmd, capture_output=True, text=True)
        if dur_res.returncode == 0 and dur_res.stdout.strip():
            duration = round(float(dur_res.stdout.strip()), 2)
    except Exception as e:
        print(f"Could not probe duration: {e}")

    processed_tracks.append({
        "id": track_id,
        "title": track["title"],
        "artist": track["artist"],
        "audioUrl": f"/audio/{track_id}.mp3",
        "duration": duration,
        "artwork": f"https://img.youtube.com/vi/{track_id}/hqdefault.jpg",
        "youtubeUrl": f"https://www.youtube.com/watch?v={track_id}",
    })

# Write playlist.json
playlist_path = os.path.join(DATA_DIR, "playlist.json")
with open(playlist_path, "w", encoding="utf-8") as f:
    json.dump(processed_tracks, f, indent=2)

print("\n--- DONE ---")
print(f"Wrote {len(processed_tracks)} tracks to {playlist_path}")
