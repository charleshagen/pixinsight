import zipfile
import subprocess
from datetime import date
from pathlib import Path


def zip_directories():
    base_dir = Path.cwd()
    rsc_dir = base_dir / "rsc"
    src_dir = base_dir / "src"

    updates_dir = base_dir / "updates"
    updates_dir.mkdir(exist_ok=True)

    zip_name = updates_dir / f"nightphotons-{date.today().isoformat()}.zip"

    missing = [d.name for d in (rsc_dir, src_dir) if not d.exists()]
    if missing:
        raise FileNotFoundError(f"Directory/ies not found: {', '.join(missing)}")

    with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add all files from rsc/ (no exclusions)
        for file in rsc_dir.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(base_dir))

        # Add files from src/, skipping .xsgn files
        for file in src_dir.rglob("*"):
            if file.is_file() and file.suffix != ".xsgn":
                zf.write(file, file.relative_to(base_dir))

    print(f"Created: {zip_name.relative_to(base_dir)}")

    with zipfile.ZipFile(zip_name) as zf:
        names = zf.namelist()
    print(f"Packed {len(names)} file(s):")
    for name in names:
        print(f"  {name}")

    result = subprocess.run(
        ["certutil", "-hashfile", str(zip_name), "SHA1"],
        capture_output=True,
        text=True,
    )
    print("\nupdates.xri entry:")
    if result.returncode == 0:
        print(f"<package fileName=\"{zip_name.name}\" sha1=\"{result.stdout.splitlines()[1]}\" type=\"script\" releaseDate=\"{date.today().strftime('%Y%m%d')}\">")
    else:
        print(result.stderr)


if __name__ == "__main__":
    zip_directories()