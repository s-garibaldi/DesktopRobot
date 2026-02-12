#!/usr/bin/env python3
"""
Audio analysis script for backing tracks.
Detects: BPM, Key, Genre, and recommended scales for soloing.

Usage: python analyze_audio.py <path_to_mp3>
Outputs: JSON to stdout with analysis results
"""

import sys
import json
import warnings
warnings.filterwarnings('ignore')

try:
    import librosa
    import numpy as np
except ImportError as e:
    print(json.dumps({'error': f'Missing library: {e}'}), file=sys.stderr)
    sys.exit(1)


# Musical key to scale mappings
SCALE_RECOMMENDATIONS = {
    'C major': ['C Major (Ionian)', 'C Major Pentatonic', 'A Minor Pentatonic', 'A Natural Minor'],
    'C minor': ['C Minor (Aeolian)', 'C Minor Pentatonic', 'C Dorian', 'C Blues Scale'],
    'C# major': ['C# Major (Ionian)', 'C# Major Pentatonic', 'A# Minor Pentatonic'],
    'Db major': ['Db Major (Ionian)', 'Db Major Pentatonic', 'Bb Minor Pentatonic'],
    'C# minor': ['C# Minor (Aeolian)', 'C# Minor Pentatonic', 'C# Dorian'],
    'D major': ['D Major (Ionian)', 'D Major Pentatonic', 'B Minor Pentatonic', 'D Mixolydian'],
    'D minor': ['D Minor (Aeolian)', 'D Minor Pentatonic', 'D Dorian', 'D Blues Scale'],
    'D# major': ['D# Major (Ionian)', 'D# Major Pentatonic', 'C Minor Pentatonic'],
    'Eb major': ['Eb Major (Ionian)', 'Eb Major Pentatonic', 'C Minor Pentatonic'],
    'D# minor': ['D# Minor (Aeolian)', 'D# Minor Pentatonic', 'D# Dorian'],
    'E major': ['E Major (Ionian)', 'E Major Pentatonic', 'C# Minor Pentatonic', 'E Mixolydian'],
    'E minor': ['E Minor (Aeolian)', 'E Minor Pentatonic', 'E Dorian', 'E Blues Scale'],
    'F major': ['F Major (Ionian)', 'F Major Pentatonic', 'D Minor Pentatonic', 'F Lydian'],
    'F minor': ['F Minor (Aeolian)', 'F Minor Pentatonic', 'F Dorian', 'F Blues Scale'],
    'F# major': ['F# Major (Ionian)', 'F# Major Pentatonic', 'D# Minor Pentatonic'],
    'Gb major': ['Gb Major (Ionian)', 'Gb Major Pentatonic', 'Eb Minor Pentatonic'],
    'F# minor': ['F# Minor (Aeolian)', 'F# Minor Pentatonic', 'F# Dorian'],
    'G major': ['G Major (Ionian)', 'G Major Pentatonic', 'E Minor Pentatonic', 'G Mixolydian'],
    'G minor': ['G Minor (Aeolian)', 'G Minor Pentatonic', 'G Dorian', 'G Blues Scale'],
    'G# major': ['G# Major (Ionian)', 'G# Major Pentatonic', 'F Minor Pentatonic'],
    'Ab major': ['Ab Major (Ionian)', 'Ab Major Pentatonic', 'F Minor Pentatonic'],
    'G# minor': ['G# Minor (Aeolian)', 'G# Minor Pentatonic', 'G# Dorian'],
    'A major': ['A Major (Ionian)', 'A Major Pentatonic', 'F# Minor Pentatonic', 'A Mixolydian'],
    'A minor': ['A Minor (Aeolian)', 'A Minor Pentatonic', 'A Dorian', 'A Blues Scale'],
    'A# major': ['A# Major (Ionian)', 'A# Major Pentatonic', 'G Minor Pentatonic'],
    'Bb major': ['Bb Major (Ionian)', 'Bb Major Pentatonic', 'G Minor Pentatonic'],
    'A# minor': ['A# Minor (Aeolian)', 'A# Minor Pentatonic', 'A# Dorian'],
    'B major': ['B Major (Ionian)', 'B Major Pentatonic', 'G# Minor Pentatonic', 'B Mixolydian'],
    'B minor': ['B Minor (Aeolian)', 'B Minor Pentatonic', 'B Dorian', 'B Blues Scale'],
}


def detect_bpm(y, sr):
    """Detect tempo/BPM using librosa."""
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    return round(float(tempo))


def detect_key(y, sr):
    """
    Detect musical key using chroma features.
    Returns key in format like 'C major', 'A minor', etc.
    """
    # Compute chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # Average chroma across time
    chroma_mean = np.mean(chroma, axis=1)
    
    # Key profiles (Krumhansl-Schmuckler key-finding algorithm)
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    
    # Pitch classes
    pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    best_correlation = -1
    detected_key = 'C major'
    
    # Test all possible keys
    for i in range(12):
        # Major key
        rotated_major = np.roll(major_profile, i)
        corr_major = np.corrcoef(chroma_mean, rotated_major)[0, 1]
        if corr_major > best_correlation:
            best_correlation = corr_major
            detected_key = f'{pitch_classes[i]} major'
        
        # Minor key
        rotated_minor = np.roll(minor_profile, i)
        corr_minor = np.corrcoef(chroma_mean, rotated_minor)[0, 1]
        if corr_minor > best_correlation:
            best_correlation = corr_minor
            detected_key = f'{pitch_classes[i]} minor'
    
    return detected_key


def estimate_genre(y, sr):
    """
    Rough genre estimation based on spectral features.
    This is a simplified heuristic - real genre classification needs ML models.
    """
    # Compute spectral features
    spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
    spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
    zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y))
    
    # Get tempo for genre hints
    tempo = detect_bpm(y, sr)
    
    # Very rough heuristics (would need ML for accuracy)
    if spectral_centroid > 3000 and zero_crossing_rate > 0.15:
        if tempo > 140:
            return 'Rock'
        return 'Metal'
    elif spectral_centroid < 1500:
        if tempo < 100:
            return 'Blues'
        return 'R&B'
    elif tempo > 160:
        return 'Punk'
    elif tempo < 90 and spectral_rolloff < 3000:
        return 'Jazz'
    elif 90 <= tempo <= 120:
        return 'Pop'
    elif 120 < tempo <= 140:
        return 'Rock'
    
    return 'Other'


def get_scale_recommendations(key):
    """Get recommended scales for soloing based on detected key."""
    return SCALE_RECOMMENDATIONS.get(key, ['Major Pentatonic', 'Minor Pentatonic', 'Blues Scale'])


def analyze_audio(file_path):
    """Main analysis function."""
    try:
        # Load audio file
        y, sr = librosa.load(file_path, duration=60)  # Analyze first 60 seconds for speed
        
        # Detect BPM
        bpm = detect_bpm(y, sr)
        
        # Detect key
        key = detect_key(y, sr)
        
        # Estimate genre
        genre = estimate_genre(y, sr)
        
        # Get scale recommendations
        scales = get_scale_recommendations(key)
        
        # Format key for UI (convert 'C major' to 'C', 'A minor' to 'Am')
        key_parts = key.split()
        if key_parts[1] == 'minor':
            key_formatted = key_parts[0] + 'm'
        else:
            key_formatted = key_parts[0]
        
        return {
            'success': True,
            'bpm': bpm,
            'key': key_formatted,
            'genre': genre,
            'scales': scales,
            'confidence': {
                'bpm': 'high',
                'key': 'medium',
                'genre': 'low'  # Genre detection is rough without ML
            }
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python analyze_audio.py <path_to_mp3>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = analyze_audio(file_path)
    print(json.dumps(result, indent=2))
