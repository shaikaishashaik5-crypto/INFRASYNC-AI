## 🚀 Run InfraSync AI with Docker

InfraSync AI is a real-time construction site coordination platform. Workers can submit progress updates from the field, and managers can monitor updates in real time.

### Prerequisites

- Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) or Docker Engine on Ubuntu.
- Ensure Docker is running and your computer has an internet connection.

### Quick Start

**1. Download the latest Docker image**

```bash
docker pull ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

**2. Run InfraSync AI**

```bash
docker run --rm -p 8000:8000 -v infrasync-data:/data ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

**3. Open the application**

Open your browser and visit:

http://localhost:8000

If port 8000 is already in use, run the application on port 8001 instead:

```bash
docker run --rm -p 8001:8000 -v infrasync-data:/data ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

Then visit http://localhost:8001.

### Demo Login

| Role | Login | PIN |
|---|---|---|
| Manager | Site Manager | `admin123` |
| Workers | Arjun, Priya, Rahul, Meera, Sanjay, Kavya, Imran, Anita | `1234` |

**Security:** These are demo credentials. Change the default PINs before deploying the application for real-world use.

### Updating to the Latest Version

Whenever a new version is published to GitHub Container Registry, download it with:

```bash
docker pull ghcr.io/shaikaishashaik5-crypto/infrasync-ai:latest
```

Stop any currently running container, then run the application again using the command above.

### Data Persistence

The Docker volume `infrasync-data` stores application data under `/data` inside the container. Verify that your application is configured to use `/data` for its SQLite database and uploaded photos.
