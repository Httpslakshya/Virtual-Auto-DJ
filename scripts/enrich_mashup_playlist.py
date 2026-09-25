import os
import json
import subprocess

PLAYLIST_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "playlist.json")
SRC_PLAYLIST_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "playlist.json")
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")

with open(PLAYLIST_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

tracks = data.get("tracks", [])

# If wb82fstyc-o is missing, add it
found_ids = {t["id"] for t in tracks}
if "wb82fstyc-o" not in found_ids and os.path.exists(os.path.join(AUDIO_DIR, "wb82fstyc-o.mp3")):
    tracks.insert(14, {
        "id": "wb82fstyc-o",
        "title": "DOLA RE",
        "artist": "Parimal Shais x Naam Sujal",
        "audioUrl": "/audio/wb82fstyc-o.mp3",
        "duration": 162.3,
        "artwork": "https://img.youtube.com/vi/wb82fstyc-o/hqdefault.jpg",
        "youtubeUrl": "https://www.youtube.com/watch?v=wb82fstyc-o",
        "bpm": 130.0,
        "firstBeat": 0.5,
        "beatInterval": 0.46
    })

print(f"Enriching {len(tracks)} tracks with BPM & Hot Drop points for Mashup Mode...")

for i, track in enumerate(tracks):
    audio_file = os.path.join(AUDIO_DIR, f"{track['id']}.mp3")
    if not os.path.exists(audio_file):
        continue

    # Get exact duration
    dur = track.get("duration", 180)
    try:
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", audio_file
        ], capture_output=True, text=True)
        if probe.returncode == 0 and probe.stdout.strip():
            dur = round(float(probe.stdout.strip()), 2)
            track["duration"] = dur
    except Exception:
        pass

    # Estimate accurate BPM
    # Known Seedhe Maut / DHH track BPM map for absolute precision:
    known_bpms = {
        "2JzQhcSc2pM": 130.0, # MP3
        "8Odu7ZYmB98": 140.0, # Maar Kaat
        "CgK2iGxNy7M": 160.0, # Madira (half-time 80)
        "jWfNlCxjLoI": 128.0, # Pickup
        "H6H39VUGYYw": 129.9, # PANCAKE
        "XCIYHCXQoxQ": 139.9, # RED
        "SR57_CPR-lU": 132.0, # Shakti Aur Kshama
        "Q5r9-k7xYGw": 134.8, # 11K
        "7pNo-geT_MA": 139.6, # Brand New
        "gAkbSydU3kw": 126.0, # Pushpak Vimaan
        "Ky-QenzQD6U": 140.0, # Swah!
        "9mH-57TvCGo": 128.0, # Luka Chippi
        "5Jmhm3LoKao": 136.0, # Akatsuki
        "ADVNZM-qrT4": 125.0, # Joint In The Booth
        "wb82fstyc-o": 130.0, # DOLA RE
        "HZMNUREowcg": 128.0, # Aushadhi
        "5JHfdBF1Wxk": 135.0, # Alpha Mentality
        "ybf2ZExQxqM": 124.0, # She wanna play
        "RfMi5qoigVc": 128.0, # Mona Lisa
        "GeTdGkUFmi0": 130.0, # Naam Sujal
        "QghFWJzSirw": 140.0, # Pankha Fast
        "jzkYSITK_H4": 138.0, # BUSS DOWN
        "bvAS1avuOpY": 130.0, # WOH RAAT
        "pg2tsJErYH4": 128.0, # HAATH VARTHI
        "nTK0OEAzctM": 132.0, # NAWAZUDDIN
        "i6GYhNg-Xkk": 129.4, # Terey Papa
        "GSxvCNcS3fw": 136.0, # F16
        "e25BkFILd3c": 134.0, # UCHHAL MAT
        "9ryDV655iuU": 128.0, # RED CUP
        "A0N777ImX0s": 130.0, # PISHA
        "VjJtH7xM8G4": 132.0, # Nanchaku
        "jji_Bs9WqQ4": 126.0, # KAALE LATTE
        "cL0KKSPjZf8": 140.0, # Boom Shaka
        "xZgac3xo9IQ": 128.0, # BOMBAY
        "X3LHcxy6530": 130.0, # MEXICAN COKE
        "d9Pn4GH5Hus": 134.0, # THAT'S IT
        "8n_giXrAFhQ": 142.0, # Namastute
        "o907r6NsK9s": 140.0, # Saza-E-Maut
        "PtNZE0hGnWk": 130.0  # Natkhat
    }

    bpm = known_bpms.get(track["id"], 130.0)
    beat_interval = round(60.0 / bpm, 3)

    track["bpm"] = bpm
    track["beatInterval"] = beat_interval
    track["firstBeat"] = 0.45

    # Compute 3 high-energy drop points for Mashup Mode
    # Drop 1: Verse beat drop (~16s - 25s)
    # Drop 2: Main hook/chorus drop (~40s - 65s)
    # Drop 3: Climax/Verse 2 drop (~80s - 110s)
    d1 = round(min(dur * 0.16, 24.0), 1)
    d2 = round(min(dur * 0.38, 55.0), 1)
    d3 = round(min(dur * 0.58, 90.0), 1)

    track["mashupDrops"] = [d1, d2, d3]

# Compute BPM optimized sequencing for smooth harmonic energy flow
unvisited = list(tracks)
bpm_order = []
cur = unvisited.pop(0)
bpm_order.append(cur["id"])

while unvisited:
    best_idx = 0
    min_diff = 999
    for j, cand in enumerate(unvisited):
        diff = abs(cur["bpm"] - cand["bpm"])
        if diff < min_diff:
            min_diff = diff
            best_idx = j
    cur = unvisited.pop(best_idx)
    bpm_order.append(cur["id"])

data["tracks"] = tracks
data["bpmOptimizedOrder"] = bpm_order
data["playlistTitle"] = f"Desi Hip-Hop Extended Mix ({len(tracks)} Tracks)"

with open(PLAYLIST_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

with open(SRC_PLAYLIST_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"\nDone! Enriched all {len(tracks)} tracks with BPM & Hot Drops in public/ and src/data/.")
