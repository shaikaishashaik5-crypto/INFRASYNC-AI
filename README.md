## 🚀 Run InfraSync AI on Windows, Ubuntu, or Docker

InfraSync AI is a real-time construction site coordination platform. Workers report progress from the field, and managers see updates instantly.

### Prerequisites

- **Windows:** Windows 10/11 with [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) or [Python 3.10+](https://www.python.org/downloads/windows/).
- **Ubuntu:** Python 3.10+ for local execution, or Docker Engine for container execution.
- **Docker:** An internet connection to download the latest image.

---

### 🪟 Option 1: Windows — Docker (Recommended)

Install and start Docker Desktop, then open **CMD or PowerShell**.

**1. Download the latest image**

```powershell
docker pull ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

**2. Run InfraSync AI**

```powershell
docker run --rm -p 8000:8000 -v infrasync-data:/data ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

**3. Open the application**

http://localhost:8000

If port 8000 is busy, use port 8001:

```powershell
docker run --rm -p 8001:8000 -v infrasync-data:/data ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

Open http://localhost:8001.

### 🪟 Option 2: Windows — Python

**1.** Install Python 3.10+ and enable **Add Python to PATH**.

**2.** Extract the project ZIP and open the extracted project folder.

**3.** Double-click `run.bat`, or run these commands in CMD from the project folder:

```bat
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
py main.py
```

If the application requires Uvicorn to start, use the startup command specified in `run.bat` or the project documentation instead of `py main.py`.

Open http://localhost:8000.

### 🐧 Option 3: Ubuntu — Docker (Recommended)

Install Docker Engine and start the Docker service first.

**1. Download the image**

```bash
sudo docker pull ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

**2. Run the application**

```bash
sudo docker run --rm -p 8000:8000 -v infrasync-data:/data ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

**3. Open the application**

http://localhost:8000

If port 8000 is busy, change the left side of the port mapping to `8001:8000` and open http://localhost:8001.

### 🐧 Option 4: Ubuntu — Python

From the extracted project directory, run:

```bash
chmod +x run.sh
./run.sh
```

Open http://localhost:8000. Follow any additional setup instructions printed by the script.

---

### 👤 Demo Login

| Role | Login | PIN |
|---|---|---|
| Manager | Site Manager | `admin123` |
| Workers | Arjun, Priya, Rahul, Meera, Sanjay, Kavya, Imran, Anita | `1234` |

**Security:** These are demo credentials. Change the default PINs before using the application in a real environment.

### 🔄 Update to the Latest Version

Whenever a new Docker image is published, download it again:

```bash
docker pull ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

Stop the existing container and start it again with the run command for your operating system.

### 💾 Data Persistence

Docker stores application data in the `infrasync-data` volume mounted at `/data`. The application must be configured to store its SQLite database and uploaded photos under `/data` for them to persist.

### ✨ Features

- Real-time worker progress updates using WebSockets.
- Manager dashboard with project and task monitoring.
- Task assignment and progress tracking.
- Delay reporting with explanations and photo evidence.
- Role-based worker access to assigned tasks.
- Responsive interface for desktop and mobile devices.
