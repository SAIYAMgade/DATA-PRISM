import sys
import subprocess
from pathlib import Path

def main():
    base_dir = Path(__file__).resolve().parent
    venv_python = base_dir / ".venv" / "Scripts" / "python.exe"
    
    if not venv_python.exists():
        print("Virtual environment not found. Please run setup first.")
        sys.exit(1)

    print("=" * 60)
    print("Starting DATAPRISM: Analytics Workspace")
    print("Tagline: See the data. Understand the signal. Make better decisions.")
    print("=" * 60)
    print("Serving Unified Application (API + Frontend) at: http://127.0.0.1:8050")
    print("API Documentation (Swagger UI) at: http://127.0.0.1:8050/docs")
    print("=" * 60)

    cmd = [
        str(venv_python),
        "-m", "uvicorn",
        "apps.api.app.main:app",
        "--host", "127.0.0.1",
        "--port", "8050"
    ]
    try:
        subprocess.run(cmd, cwd=str(base_dir))
    except KeyboardInterrupt:
        print("\nDATAPRISM stopped cleanly.")

if __name__ == "__main__":
    main()
