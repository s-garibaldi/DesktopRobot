import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const BACKING_TRACKS_DIR = process.env.BACKING_TRACKS_DIR ?? path.join(process.cwd(), '..', 'frontend', 'public', 'backing-tracks');
const PYTHON_SCRIPT = path.join(process.cwd(), 'scripts', 'analyze_audio.py');

interface AnalysisResult {
  success: boolean;
  bpm?: number;
  key?: string;
  genre?: string;
  scales?: string[];
  confidence?: {
    bpm: string;
    key: string;
    genre: string;
  };
  error?: string;
}

function runPythonAnalysis(audioPath: string): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [PYTHON_SCRIPT, audioPath]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout) as AnalysisResult;
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse analysis result: ${err}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

/** POST: Analyze an existing backing track file. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    // Prevent path traversal
    if (filename.includes('..') || path.isAbsolute(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filepath = path.join(BACKING_TRACKS_DIR, filename);

    // Run Python analysis
    const result = await runPythonAnalysis(filepath);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Analysis failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      filename,
      analysis: {
        bpm: result.bpm,
        key: result.key,
        genre: result.genre,
        scales: result.scales,
        confidence: result.confidence,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
