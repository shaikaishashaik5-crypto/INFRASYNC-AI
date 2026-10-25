"""INFRASYNC AI - construction site coordination platform.

Starlette + SQLite + WebSocket (real-time). Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, ValidationError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket, WebSocketDisconnect

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
DATA = Path(os.getenv("INFRASYNC_DATA", ROOT / "data"))
UPLOADS = DATA / "uploads"
DATA.mkdir(parents=True, exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)
DB = DATA / "infrasync.db"
MAX_PHOTO_BYTES = 12 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

MANAGER_PIN = os.getenv("MANAGER_PIN", "admin123")
WORKER_PIN = os.getenv("WORKER_PIN", "1234")

# ---------------------------------------------------------------- secrets
_secret_file = DATA / ".secret"
if not _secret_file.exists():
    _secret_file.write_text(secrets.token_hex(32))
SECRET = _secret_file.read_text().strip().encode()

# ---------------------------------------------------------------- people
MANAGER = {"id": "manager", "name": "Site Manager", "role": "manager", "trade": "Management", "color": "#67e0b1"}
WORKERS = [
    {"id": "worker1", "name": "Arjun Kumar", "trade": "Civil", "color": "#57d9a3"},
    {"id": "worker2", "name": "Priya Sharma", "trade": "Electrical", "color": "#79a8ff"},
    {"id": "worker3", "name": "Rahul Reddy", "trade": "Plumbing", "color": "#f6bd60"},
    {"id": "worker4", "name": "Meera Das", "trade": "Finishing", "color": "#d7a7ff"},
    {"id": "worker5", "name": "Sanjay Verma", "trade": "Structural", "color": "#ff9f7a"},
    {"id": "worker6", "name": "Kavya Nair", "trade": "Safety", "color": "#ff7b86"},
    {"id": "worker7", "name": "Imran Sheikh", "trade": "Mechanical", "color": "#5fd3e8"},
    {"id": "worker8", "name": "Anita Rao", "trade": "Planning", "color": "#b6e36b"},
]
for w in WORKERS:
    w["role"] = "worker"
WORKER_IDS = {w["id"] for w in WORKERS}
TRADE_OWNER = {"Civil": "worker1", "Electrical": "worker2", "Plumbing": "worker3", "Finishing": "worker4",
               "Structural": "worker5", "Safety": "worker6", "Quality": "worker6", "Mechanical": "worker7",
               "Planning": "worker8"}
TRADES = ["Planning", "Civil", "Structural", "Electrical", "Plumbing", "Mechanical", "Finishing", "Safety", "Quality"]

# ---------------------------------------------------------------- work templates
TEMPLATES = {
    "Residential Building": [
        ("Site survey & layout", "Planning", "Survey site, mark boundaries and verify benchmarks", 2),
        ("Safety setup & site induction", "Safety", "Fence site, install signage, PPE induction for all crews", 1),
        ("Excavation & earthwork", "Civil", "Excavate foundations and document soil conditions", 5),
        ("Foundation reinforcement", "Structural", "Install reinforcement and request inspection", 4),
        ("Concrete foundation pour", "Civil", "Pour, level and cure foundation concrete", 3),
        ("Column & slab formwork", "Structural", "Install formwork and check dimensions", 5),
        ("Electrical conduit rough-in", "Electrical", "Install concealed conduits before slab closure", 3),
        ("Plumbing rough-in", "Plumbing", "Install sleeves and water/drainage lines", 3),
        ("Slab concrete pour", "Civil", "Pour slab after all pre-pour checks are approved", 2),
        ("Masonry walls", "Civil", "Build block/brick walls and record completed area", 6),
        ("Electrical wiring", "Electrical", "Pull wires and test circuits", 4),
        ("Plastering", "Finishing", "Apply internal and external plaster", 5),
        ("Waterproofing", "Civil", "Apply waterproofing and perform pond test", 3),
        ("Flooring & finishes", "Finishing", "Install floor finish and inspect quality", 6),
        ("Final safety & quality inspection", "Quality", "Close punch-list and submit final evidence", 2),
    ],
    "Road Construction": [
        ("Survey & traffic plan", "Planning", "Survey alignment and set traffic controls", 2),
        ("Site safety & barricading", "Safety", "Install barricades, signage and traffic marshals", 1),
        ("Clearance & excavation", "Civil", "Clear right-of-way and excavate formation", 5),
        ("Subgrade preparation", "Civil", "Compact subgrade and record density test", 3),
        ("Drainage installation", "Civil", "Install culverts and roadside drains", 4),
        ("Utility ducts & street lighting", "Electrical", "Lay cable ducts and street light foundations", 4),
        ("Granular sub-base", "Civil", "Spread and compact granular sub-base", 3),
        ("Wet mix macadam", "Civil", "Lay and compact base course", 3),
        ("Prime coat", "Civil", "Apply prime coat and document weather conditions", 1),
        ("Asphalt paving", "Mechanical", "Lay asphalt and record temperature/compaction", 4),
        ("Road markings & signage", "Safety", "Install markings, signs and safety barriers", 2),
        ("Final quality inspection", "Quality", "Submit test results and completion photos", 2),
    ],
    "Commercial Fit-out": [
        ("Site measurements & protection", "Planning", "Verify dimensions and protect existing areas", 2),
        ("Partition framing", "Finishing", "Install partition framing and coordinate services", 3),
        ("Electrical first fix", "Electrical", "Install conduits, boxes and cable trays", 3),
        ("Plumbing first fix", "Plumbing", "Install supply and waste lines", 3),
        ("HVAC ducting", "Mechanical", "Install ducting and equipment openings", 4),
        ("Fire & safety systems", "Safety", "Install sprinklers, alarms and emergency lighting", 3),
        ("Boarding & ceiling closure", "Finishing", "Close walls/ceilings after services inspection", 3),
        ("Painting", "Finishing", "Prepare surfaces and apply paint system", 4),
        ("Fixtures & fittings", "Finishing", "Install fixtures and test functionality", 3),
        ("Testing & commissioning", "Quality", "Test systems and record results", 2),
        ("Client handover", "Planning", "Complete snag list and handover documents", 1),
    ],
    "Bridge Construction": [
        ("Geotechnical survey", "Planning", "Soil investigation and alignment survey", 4),
        ("Safety & marine/traffic plan", "Safety", "Establish safe work zones and emergency plan", 2),
        ("Pile foundation boring", "Civil", "Bore piles and record depth logs", 10),
        ("Pile cap reinforcement", "Structural", "Fix rebar cages for pile caps", 5),
        ("Pier construction", "Civil", "Cast piers with formwork and curing", 12),
        ("Girder fabrication", "Structural", "Fabricate and test precast girders", 14),
        ("Girder launching", "Mechanical", "Crane/launcher erection of girders", 6),
        ("Deck slab casting", "Civil", "Cast deck slab and cure", 8),
        ("Bearings & expansion joints", "Structural", "Install bearings and joints", 3),
        ("Lighting & utilities", "Electrical", "Install bridge lighting and conduits", 4),
        ("Wearing coat & railings", "Finishing", "Asphalt wearing coat and railings", 5),
        ("Load test & handover", "Quality", "Perform load test and submit report", 3),
    ],
    "Solar Power Plant": [
        ("Land survey & grading", "Planning", "Topographic survey and land grading plan", 4),
        ("Site safety & fencing", "Safety", "Perimeter fencing, signage and safety induction", 2),
        ("Piling & foundations", "Civil", "Install mounting structure foundations", 8),
        ("Mounting structure erection", "Structural", "Assemble and align module mounting tables", 8),
        ("Module installation", "Electrical", "Install PV modules and string cabling", 10),
        ("Inverter & transformer yard", "Electrical", "Install inverters, transformer and switchgear", 6),
        ("Cable trenching & laying", "Civil", "Excavate trenches and lay DC/AC cables", 7),
        ("SCADA & monitoring", "Mechanical", "Install weather stations and SCADA", 4),
        ("Earthing & lightning protection", "Safety", "Earth pits and lightning arrestors", 3),
        ("Testing & grid synchronisation", "Quality", "IV curve tests, protection tests and grid sync", 4),
    ],
    "Water Pipeline": [
        ("Route survey & permits", "Planning", "Survey route and secure right-of-way permits", 4),
        ("Safety & traffic management", "Safety", "Trench safety plan and traffic diversions", 2),
        ("Trench excavation", "Civil", "Excavate trench to grade", 8),
        ("Pipe laying & jointing", "Plumbing", "Lay, align and joint pipes", 10),
        ("Valve chambers", "Civil", "Construct valve and air-release chambers", 5),
        ("Pump station mechanical", "Mechanical", "Install pumps, motors and manifolds", 6),
        ("Pump station electrical", "Electrical", "Install panels, cabling and controls", 5),
        ("Hydrostatic pressure test", "Quality", "Pressure test sections and record results", 3),
        ("Backfill & road restoration", "Civil", "Backfill, compact and reinstate surface", 6),
        ("Disinfection & commissioning", "Quality", "Flush, disinfect and commission line", 2),
    ],
}

# ---------------------------------------------------------------- delay-cause analysis (rule-based NLP)
CAUSES = {
    "Material shortage": ["material", "cement", "steel", "sand", "supply", "supplier", "delivery", "delivered", "stock",
                          "shortage", "rebar", "aggregate", "brick", "pipe", "cable", "short", "not arrived", "truck"],
    "Bad weather": ["rain", "weather", "storm", "flood", "wind", "heat", "fog", "waterlog", "cyclone", "lightning",
                    "monsoon", "wet", "slippery", "drizzle"],
    "Labour shortage": ["labour", "labor", "worker", "manpower", "absent", "strike", "crew", "attendance", "festival",
                        "leave", "helpers", "not enough people"],
    "Equipment failure": ["machine", "equipment", "breakdown", "broke", "crane", "excavator", "mixer", "pump",
                          "generator", "repair", "fuel", "vehicle", "tool", "jcb", "compressor"],
    "Design / scope change": ["design", "drawing", "revision", "revised", "change", "client", "scope", "clarification",
                              "rework", "specification", "variation", "redo"],
    "Permit / inspection": ["permit", "inspection", "approval", "approve", "clearance", "authority", "noc", "license",
                            "consultant", "sign-off", "signoff", "pending", "waiting for"],
    "Safety incident": ["safety", "accident", "injury", "injured", "unsafe", "hazard", "incident", "ppe", "stop work",
                        "collapse", "near miss"],
    "Site access / utilities": ["access", "blocked", "power cut", "electricity", "no water", "utility", "traffic",
                                "land", "dispute", "gate", "road closed", "outage"],
    "Other": [],
}
CAUSE_ACTIONS = {
    "Material shortage": "Escalate to procurement, confirm supplier ETA and consider an alternate vendor.",
    "Bad weather": "Re-sequence indoor/sheltered work and add weather buffer to dependent tasks.",
    "Labour shortage": "Reassign nearby crews or approve overtime / extra manpower for this task.",
    "Equipment failure": "Dispatch maintenance or arrange a replacement/rental machine immediately.",
    "Design / scope change": "Get the revised drawing signed off and brief the crew before restarting.",
    "Permit / inspection": "Chase the approving authority or consultant and escalate the pending sign-off.",
    "Safety incident": "Hold a safety review, document corrective actions before resuming work.",
    "Site access / utilities": "Coordinate with site admin / utility provider to restore access or supply.",
    "Other": "Call the worker to clarify the cause and agree a recovery plan.",
}


def analyze_delay(chosen: str, reason: str, notes: str, delay_days: int) -> dict:
    text = f" {reason} {notes} ".lower()
    scores = {}
    matched = {}
    for cause, words in CAUSES.items():
        hits = [w for w in words if re.search(r"(?<![a-z])" + re.escape(w), text)]
        if hits:
            scores[cause] = len(hits)
            matched[cause] = hits
    if chosen in CAUSES and chosen != "Other":
        scores[chosen] = scores.get(chosen, 0) + 1.5
    if not scores:
        best, conf, kw = chosen if chosen in CAUSES else "Other", 0.5, []
    else:
        best = max(scores, key=scores.get)
        kw = matched.get(best, [])
        agrees = chosen == best
        conf = min(0.97, 0.52 + 0.1 * len(kw) + (0.18 if agrees else 0))
    sev = "high" if delay_days >= 5 else "medium" if delay_days >= 2 else "low"
    return {"cause": best, "confidence": round(conf, 2), "keywords": kw, "severity": sev,
            "action": CAUSE_ACTIONS[best]}


# ---------------------------------------------------------------- db
def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def today() -> date:
    return date.today()


def connect():
    c = sqlite3.connect(DB, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("PRAGMA journal_mode=WAL")
    return c


def log(c, kind, message, project_id=None, task_id=None, worker_id=None, actor=None):
    c.execute("INSERT INTO activity(kind,message,project_id,task_id,worker_id,actor,created_at) VALUES(?,?,?,?,?,?,?)",
              (kind, message, project_id, task_id, worker_id, actor, now()))


def wname(wid):
    return next((w["name"] for w in WORKERS if w["id"] == wid), wid or "Unassigned")


def write_demo_svg(name: str, title: str, subtitle: str, hue: int) -> str:
    svg = f"""<svg xmlns='http://www.w3.org/2000/svg' width='960' height='640' viewBox='0 0 960 640'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl({hue},45%,22%)'/><stop offset='1' stop-color='hsl({hue + 40},50%,10%)'/></linearGradient></defs>
<rect width='960' height='640' fill='url(#g)'/>
<g opacity='.35' fill='none' stroke='hsl({hue},80%,70%)' stroke-width='3'><path d='M0 520 L960 470'/><path d='M120 520 V300 L260 220 L400 300 V500'/><path d='M520 480 V260 H760 V470'/><circle cx='820' cy='140' r='60'/></g>
<text x='48' y='88' fill='#fff' font-family='sans-serif' font-size='40' font-weight='700'>{title}</text>
<text x='48' y='136' fill='#cfe' font-family='sans-serif' font-size='24'>{subtitle}</text>
<text x='48' y='600' fill='#9ab' font-family='sans-serif' font-size='20'>DEMO EVIDENCE PHOTO (sample data)</text></svg>"""
    (UPLOADS / name).write_text(svg)
    return "/uploads/" + name


def init_db():
    with connect() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,location TEXT,template TEXT,
            start_date TEXT,created_at TEXT);
        CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,title TEXT NOT NULL,trade TEXT,
            description TEXT,assignee TEXT,start_date TEXT,due_date TEXT,duration_days INTEGER DEFAULT 1,
            status TEXT DEFAULT 'assigned',progress INTEGER DEFAULT 0,started_at TEXT,completed_at TEXT,
            created_at TEXT,updated_at TEXT,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,project_id TEXT,worker_id TEXT,
            kind TEXT,cause TEXT,reason TEXT,notes TEXT,delay_days INTEGER DEFAULT 0,photos TEXT,ai_cause TEXT,
            ai_confidence REAL,ai_action TEXT,ai_keywords TEXT,severity TEXT,reviewed INTEGER DEFAULT 0,
            manager_note TEXT,created_at TEXT,FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS updates(id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT,project_id TEXT,
            worker_id TEXT,progress INTEGER,note TEXT,created_at TEXT);
        CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,message TEXT,project_id TEXT,
            task_id TEXT,worker_id TEXT,actor TEXT,created_at TEXT);
        """)
        if c.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 0:
            seed(c)


def seed(c):
    t0 = today()
    d = lambda n: (t0 + timedelta(days=n)).isoformat()
    pid = "PRJ-1001"
    c.execute("INSERT INTO projects VALUES(?,?,?,?,?,?)",
              (pid, "Northstar Heights", "Hyderabad, Telangana", "Residential Building", d(-14), now()))
    # (index in template, status, progress, start offset, due offset)
    plan = [(0, "completed", 100, -14, -12), (1, "completed", 100, -12, -11), (2, "completed", 100, -11, -6),
            (3, "delayed", 55, -6, -1), (4, "in_progress", 40, -3, 1), (5, "delayed", 30, -2, 0),
            (6, "in_progress", 65, -1, 2), (7, "assigned", 0, 1, 4), (8, "assigned", 0, 3, 5),
            (9, "assigned", 0, 4, 10)]
    tmpl = TEMPLATES["Residential Building"]
    ids = {}
    for i, status, prog, so, do in plan:
        title, trade, desc, days = tmpl[i]
        tid = f"T-{100 + i}"
        ids[i] = tid
        asg = TRADE_OWNER[trade]
        c.execute("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (tid, pid, title, trade, desc, asg, d(so), d(do), days, status, prog,
                   (t0 + timedelta(days=so)).isoformat() if status != "assigned" else None,
                   (t0 + timedelta(days=do)).isoformat() if status == "completed" else None, now(), now()))
    log(c, "project", "Project Northstar Heights created from Residential Building template", pid, actor="manager")
    # demo delay reports
    p1 = write_demo_svg("demo-rebar.svg", "Rebar delivery short", "Foundation reinforcement - 40% steel missing", 20)
    p2 = write_demo_svg("demo-site.svg", "Waterlogged formwork bay", "Heavy overnight rain on site", 205)
    p3 = write_demo_svg("demo-crane.svg", "Crane out of service", "Hydraulic fault - awaiting mechanic", 45)
    for tid_i, cause, reason, days, photos, rid in [
        (3, "Material shortage", "Steel supplier delivered only 60% of the rebar. Truck with remaining stock not arrived yet.", 3, [p1], "R-DEMO01"),
        (5, "Bad weather", "Heavy rain overnight flooded the formwork bay, cannot place formwork safely until it drains.", 2, [p2, p3], "R-DEMO02"),
    ]:
        a = analyze_delay(cause, reason, "", days)
        wid = TRADE_OWNER[tmpl[tid_i][1]]
        c.execute("INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (rid, ids[tid_i], pid, wid, "delay", cause, reason, "", days, json.dumps(photos), a["cause"],
                   a["confidence"], a["action"], json.dumps(a["keywords"]), a["severity"], 0, "", now()))
        log(c, "delay", f"{tmpl[tid_i][0]} delayed {days}d - {a['cause']} (reported by {wname(wid)})", pid, ids[tid_i], wid, wid)
    for i in (0, 1, 2):
        log(c, "completed", f"{tmpl[i][0]} completed by {wname(TRADE_OWNER[tmpl[i][1]])}", pid, ids[i], TRADE_OWNER[tmpl[i][1]],
            TRADE_OWNER[tmpl[i][1]])
    c.execute("INSERT INTO updates(task_id,project_id,worker_id,progress,note,created_at) VALUES(?,?,?,?,?,?)",
              (ids[6], pid, "worker2", 65, "Conduits done in blocks A and B, block C tomorrow.", now()))
    log(c, "progress", "Electrical conduit rough-in at 65% - Conduits done in blocks A and B", pid, ids[6], "worker2", "worker2")


# ---------------------------------------------------------------- realtime hub
class Hub:
    def __init__(self):
        self.conns: dict = {}

    async def connect(self, ws: WebSocket, uid: str):
        await ws.accept()
        self.conns[ws] = uid

    def drop(self, ws):
        self.conns.pop(ws, None)

    async def broadcast(self, payload: dict, workers=None):
        dead = []
        for ws, uid in list(self.conns.items()):
            if uid == "manager" or workers is None or uid in workers:
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead.append(ws)
        for ws in dead:
            self.drop(ws)


hub = Hub()


# ---------------------------------------------------------------- auth
def make_token(uid: str) -> str:
    return uid + "." + hmac.new(SECRET, uid.encode(), hashlib.sha256).hexdigest()[:32]


def verify_token(token: Optional[str]):
    if not token or "." not in token:
        return None
    uid, sig = token.split(".", 1)
    good = hmac.new(SECRET, uid.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, good):
        return None
    if uid == "manager":
        return MANAGER
    return next((w for w in WORKERS if w["id"] == uid), None)


def get_user(request: Request, role: Optional[str] = None):
    h = request.headers.get("authorization", "")
    u = verify_token(h.split(" ", 1)[1] if h.startswith("Bearer ") else None)
    if not u:
        raise HTTPException(401, "Please sign in again")
    if role and u["role"] != role:
        raise HTTPException(403, "Managers only" if role == "manager" else "Workers only")
    return u


# ---------------------------------------------------------------- models
class LoginIn(BaseModel):
    user_id: str
    pin: str


class TaskIn(BaseModel):
    title: str
    trade: str
    description: str = ""
    duration_days: int = 1
    assignee: str
    start_date: Optional[str] = None
    due_date: str


class ProjectIn(BaseModel):
    name: str
    location: str = ""
    template: str
    start_date: str
    tasks: list[TaskIn]


class AssignIn(BaseModel):
    assignee: Optional[str] = None
    due_date: Optional[str] = None


class ProgressIn(BaseModel):
    progress: int
    note: str = ""


class ReviewIn(BaseModel):
    note: str = ""


async def body(request: Request, model):
    try:
        return model.model_validate(await request.json())
    except ValidationError as e:
        err = e.errors()[0]
        raise HTTPException(400, f"Invalid {'.'.join(str(x) for x in err['loc'])}: {err['msg']}")
    except Exception:
        raise HTTPException(400, "Invalid request body")


def valid_date(s: str) -> str:
    try:
        return date.fromisoformat(s).isoformat()
    except Exception:
        raise HTTPException(400, f"Invalid date: {s}")


def rows(c, sql, args=()):
    return [dict(r) for r in c.execute(sql, args)]


def decorate_tasks(tasks):
    t = today().isoformat()
    for x in tasks:
        x["is_overdue"] = bool(x["due_date"] and x["due_date"] < t and x["status"] != "completed")
    return tasks


def parse_reports(reports):
    for r in reports:
        r["photos"] = json.loads(r["photos"] or "[]")
        r["ai_keywords"] = json.loads(r["ai_keywords"] or "[]")
    return reports


def ok(**kw):
    return JSONResponse({"ok": True, **kw})


# ---------------------------------------------------------------- public endpoints
async def health(request):
    return JSONResponse({"ok": True, "time": now()})


async def login(request):
    data = await body(request, LoginIn)
    if data.user_id == "manager":
        good, user = hmac.compare_digest(data.pin, MANAGER_PIN), MANAGER
    else:
        user = next((w for w in WORKERS if w["id"] == data.user_id), None)
        good = bool(user) and hmac.compare_digest(data.pin, WORKER_PIN)
    if not user or not good:
        raise HTTPException(401, "Wrong PIN")
    return JSONResponse({"token": make_token(user["id"]), "user": user})


async def login_options(request):
    return JSONResponse({"manager": MANAGER, "workers": WORKERS})


async def me(request):
    return JSONResponse(get_user(request))


async def templates(request):
    get_user(request, "manager")
    return JSONResponse({
        "trades": TRADES, "trade_owner": TRADE_OWNER, "causes": list(CAUSES.keys()),
        "templates": {name: [{"index": i, "title": t, "trade": tr, "description": ds, "duration_days": dd}
                             for i, (t, tr, ds, dd) in enumerate(items)] for name, items in TEMPLATES.items()}})


async def state(request):
    u = get_user(request)
    with connect() as c:
        if u["role"] == "manager":
            projects = rows(c, "SELECT * FROM projects ORDER BY created_at DESC, rowid DESC")
            tasks = rows(c, "SELECT * FROM tasks ORDER BY project_id, due_date, created_at")
            reports = rows(c, "SELECT * FROM reports ORDER BY created_at DESC, rowid DESC")
            updates = rows(c, "SELECT * FROM updates ORDER BY id DESC LIMIT 80")
            activity = rows(c, "SELECT * FROM activity ORDER BY id DESC LIMIT 60")
        else:
            # Workers only ever receive THEIR OWN tasks - no project progress, no other workers' data.
            tasks = rows(c, "SELECT * FROM tasks WHERE assignee=? ORDER BY due_date, created_at", (u["id"],))
            pids = list({t["project_id"] for t in tasks})
            q = ",".join("?" * len(pids)) or "''"
            projects = rows(c, f"SELECT id,name,location FROM projects WHERE id IN ({q})", pids)
            reports = rows(c, "SELECT id,task_id,kind,cause,reason,delay_days,photos,ai_cause,created_at,'' as ai_keywords "
                              "FROM reports WHERE worker_id=? ORDER BY created_at DESC", (u["id"],))
            updates, activity = [], []
    return JSONResponse({
        "role": u["role"], "me": u, "projects": projects, "tasks": decorate_tasks(tasks),
        "reports": parse_reports(reports), "updates": updates, "activity": activity,
        "workers": WORKERS if u["role"] == "manager" else [u], "today": today().isoformat(),
        "server_time": now()})


# ---------------------------------------------------------------- manager endpoints
def create_task_row(c, pid, t: TaskIn, start):
    if t.trade not in TRADES:
        raise HTTPException(400, f"Unknown field/trade: {t.trade}")
    if t.assignee not in WORKER_IDS:
        raise HTTPException(400, f"Choose a valid worker for '{t.title}'")
    if not t.title.strip():
        raise HTTPException(400, "Work title is required")
    tid = "T-" + uuid.uuid4().hex[:7].upper()
    c.execute("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              (tid, pid, t.title.strip(), t.trade, t.description.strip(), t.assignee,
               valid_date(t.start_date or start), valid_date(t.due_date), max(1, t.duration_days), "assigned", 0,
               None, None, now(), now()))
    return tid


async def create_project(request):
    get_user(request, "manager")
    data = await body(request, ProjectIn)
    if not data.name.strip():
        raise HTTPException(400, "Project name is required")
    if not data.tasks:
        raise HTTPException(400, "Select at least one work package")
    start = valid_date(data.start_date)
    pid = "PRJ-" + uuid.uuid4().hex[:6].upper()
    assignees = set()
    with connect() as c:
        c.execute("INSERT INTO projects VALUES(?,?,?,?,?,?)",
                  (pid, data.name.strip(), data.location.strip(), data.template, start, now()))
        for t in data.tasks:
            create_task_row(c, pid, t, start)
            assignees.add(t.assignee)
        log(c, "project", f"Project {data.name.strip()} created with {len(data.tasks)} work packages across "
                          f"{len({t.trade for t in data.tasks})} fields", pid, actor="manager")
    await hub.broadcast({"type": "update", "kind": "project", "actor": "manager",
                         "message": f"New project assigned: {data.name.strip()}"}, assignees)
    return ok(id=pid, task_count=len(data.tasks))


async def add_task(request):
    get_user(request, "manager")
    pid = request.path_params["pid"]
    t = await body(request, TaskIn)
    with connect() as c:
        p = c.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
        if not p:
            raise HTTPException(404, "Project not found")
        tid = create_task_row(c, pid, t, p["start_date"] or today().isoformat())
        log(c, "assign", f"New work '{t.title}' added and assigned to {wname(t.assignee)}", pid, tid, t.assignee, "manager")
    await hub.broadcast({"type": "update", "kind": "assign", "actor": "manager",
                         "message": f"New task assigned: {t.title}"}, {t.assignee})
    return ok(id=tid)


async def delete_project(request):
    get_user(request, "manager")
    pid = request.path_params["pid"]
    with connect() as c:
        for tbl in ("reports", "updates", "tasks", "activity"):
            c.execute(f"DELETE FROM {tbl} WHERE project_id=?", (pid,))
        c.execute("DELETE FROM projects WHERE id=?", (pid,))
    await hub.broadcast({"type": "update", "kind": "project", "actor": "manager", "message": "A project was removed"})
    return ok()


async def assign(request):
    get_user(request, "manager")
    tid = request.path_params["tid"]
    data = await body(request, AssignIn)
    with connect() as c:
        t = c.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        if not t:
            raise HTTPException(404, "Task not found")
        asg = data.assignee or t["assignee"]
        if asg not in WORKER_IDS:
            raise HTTPException(400, "Choose a valid worker")
        due = valid_date(data.due_date) if data.due_date else t["due_date"]
        c.execute("UPDATE tasks SET assignee=?,due_date=?,updated_at=? WHERE id=?", (asg, due, now(), tid))
        log(c, "assign", f"'{t['title']}' assigned to {wname(asg)}, due {due}", t["project_id"], tid, asg, "manager")
    await hub.broadcast({"type": "update", "kind": "assign", "actor": "manager",
                         "message": f"Task assigned to you: {t['title']}"}, {asg, t["assignee"]})
    return ok()


async def reopen(request):
    get_user(request, "manager")
    tid = request.path_params["tid"]
    with connect() as c:
        t = c.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        if not t:
            raise HTTPException(404, "Task not found")
        c.execute("UPDATE tasks SET status=?,completed_at=NULL,updated_at=? WHERE id=?",
                  ("in_progress" if t["progress"] else "assigned", now(), tid))
        log(c, "reopen", f"'{t['title']}' reopened by manager", t["project_id"], tid, t["assignee"], "manager")
    await hub.broadcast({"type": "update", "kind": "reopen", "actor": "manager",
                         "message": f"Task reopened: {t['title']}"}, {t["assignee"]})
    return ok()


async def review(request):
    get_user(request, "manager")
    rid = request.path_params["rid"]
    data = await body(request, ReviewIn)
    with connect() as c:
        r = c.execute("SELECT * FROM reports WHERE id=?", (rid,)).fetchone()
        if not r:
            raise HTTPException(404, "Report not found")
        c.execute("UPDATE reports SET reviewed=1,manager_note=? WHERE id=?", (data.note.strip(), rid))
        t = c.execute("SELECT title FROM tasks WHERE id=?", (r["task_id"],)).fetchone()
        log(c, "review", f"Delay report on '{t['title']}' reviewed by manager", r["project_id"], r["task_id"],
            r["worker_id"], "manager")
    await hub.broadcast({"type": "update", "kind": "review", "actor": "manager",
                         "message": "Manager reviewed your delay report"}, {r["worker_id"]})
    return ok()


# ---------------------------------------------------------------- worker endpoints
def own_task(c, tid, u):
    t = c.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
    if not t:
        raise HTTPException(404, "Task not found")
    if t["assignee"] != u["id"]:
        raise HTTPException(403, "You can only update your own tasks")
    return t


async def start(request):
    u = get_user(request, "worker")
    tid = request.path_params["tid"]
    with connect() as c:
        t = own_task(c, tid, u)
        if t["status"] == "completed":
            raise HTTPException(400, "Task already completed")
        c.execute("UPDATE tasks SET status=CASE WHEN status='delayed' THEN 'delayed' ELSE 'in_progress' END,"
                  "started_at=COALESCE(started_at,?),updated_at=? WHERE id=?", (now(), now(), tid))
        log(c, "start", f"{u['name']} started '{t['title']}'", t["project_id"], tid, u["id"], u["id"])
    await hub.broadcast({"type": "update", "kind": "start", "actor": u["id"],
                         "message": f"{u['name']} started {t['title']}"}, {u["id"]})
    return ok()


async def progress(request):
    u = get_user(request, "worker")
    tid = request.path_params["tid"]
    data = await body(request, ProgressIn)
    p = max(0, min(99, data.progress))
    with connect() as c:
        t = own_task(c, tid, u)
        if t["status"] == "completed":
            raise HTTPException(400, "Task already completed")
        status = "delayed" if t["status"] == "delayed" else "in_progress"
        c.execute("UPDATE tasks SET progress=?,status=?,started_at=COALESCE(started_at,?),updated_at=? WHERE id=?",
                  (p, status, now(), now(), tid))
        c.execute("INSERT INTO updates(task_id,project_id,worker_id,progress,note,created_at) VALUES(?,?,?,?,?,?)",
                  (tid, t["project_id"], u["id"], p, data.note.strip(), now()))
        log(c, "progress", f"{t['title']} at {p}% - {data.note.strip() or 'progress update'} ({u['name']})",
            t["project_id"], tid, u["id"], u["id"])
    await hub.broadcast({"type": "update", "kind": "progress", "actor": u["id"],
                         "message": f"{u['name']}: {t['title']} at {p}%"}, {u["id"]})
    return ok()


def is_upload(x):
    return hasattr(x, "filename") and hasattr(x, "read")


async def save_photos(files):
    saved = []
    for ph in files:
        if not ph.filename:
            continue
        ext = Path(ph.filename).suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, "Only JPG, PNG, WEBP or GIF photos are accepted")
        blob = await ph.read()
        if len(blob) > MAX_PHOTO_BYTES:
            raise HTTPException(400, "Photo too large (max 12 MB)")
        if not blob:
            continue
        name = uuid.uuid4().hex + ext
        (UPLOADS / name).write_bytes(blob)
        saved.append("/uploads/" + name)
    return saved


async def report(request):
    u = get_user(request, "worker")
    tid = request.path_params["tid"]
    form = await request.form(max_files=12, max_fields=40)
    kind = str(form.get("kind", ""))
    cause = str(form.get("cause", ""))
    reason = str(form.get("reason", ""))
    notes = str(form.get("notes", ""))
    try:
        delay_days = int(str(form.get("delay_days", "0") or "0"))
    except ValueError:
        delay_days = 0
    files = [x for x in form.getlist("photos") if is_upload(x)]
    if kind not in ("completed", "delay", "photo"):
        raise HTTPException(400, "Report type must be 'completed', 'delay' or 'photo'")
    with connect() as c:
        t = own_task(c, tid, u)
    if kind == "delay":
        if cause not in CAUSES:
            raise HTTPException(400, "Please pick the cause of the delay")
        if len(reason.strip()) < 5:
            raise HTTPException(400, "Please describe why the work is delayed")
        if not any(p.filename for p in files):
            raise HTTPException(400, "Photo proof is required for a delay report")
    saved = await save_photos(files)
    if kind == "delay" and not saved:
        raise HTTPException(400, "Photo proof is required for a delay report")
    if kind == "photo" and not saved:
        raise HTTPException(400, "Please add at least one photo to send")
    rid = "R-" + uuid.uuid4().hex[:8].upper()
    with connect() as c:
        if kind == "delay":
            days = max(0, min(365, delay_days))
            a = analyze_delay(cause, reason, notes, days)
            c.execute("INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (rid, tid, t["project_id"], u["id"], "delay", cause, reason.strip(), notes.strip(), days,
                       json.dumps(saved), a["cause"], a["confidence"], a["action"], json.dumps(a["keywords"]),
                       a["severity"], 0, "", now()))
            c.execute("UPDATE tasks SET status='delayed',started_at=COALESCE(started_at,?),updated_at=? WHERE id=?",
                      (now(), now(), tid))
            msg = f"'{t['title']}' is {days}d late due to {a['cause']} - reported by {u['name']}"
            log(c, "delay", msg, t["project_id"], tid, u["id"], u["id"])
            toast = f"DELAY: {msg}"
        elif kind == "photo":
            c.execute("INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (rid, tid, t["project_id"], u["id"], "photo", "", "", notes.strip(), 0, json.dumps(saved),
                       "", 0, "", "[]", "", 1, "", now()))
            c.execute("UPDATE tasks SET started_at=COALESCE(started_at,?),updated_at=? WHERE id=?", (now(), now(), tid))
            log(c, "photo", f"{u['name']} sent {len(saved)} photo(s) for '{t['title']}'", t["project_id"], tid, u["id"], u["id"])
            toast = f"{u['name']} sent {len(saved)} photo(s) for {t['title']}"
        else:
            c.execute("INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (rid, tid, t["project_id"], u["id"], "completed", "", "", notes.strip(), 0, json.dumps(saved),
                       "", 0, "", "[]", "", 1, "", now()))
            c.execute("UPDATE tasks SET status='completed',progress=100,completed_at=?,updated_at=? WHERE id=?",
                      (now(), now(), tid))
            log(c, "completed", f"{u['name']} completed '{t['title']}'", t["project_id"], tid, u["id"], u["id"])
            toast = f"{u['name']} completed {t['title']}"
    await hub.broadcast({"type": "update", "kind": kind, "actor": u["id"], "message": toast}, {u["id"]})
    return ok(report_id=rid, status={"delay": "delayed", "photo": "photo"}.get(kind, "completed"))


# ---------------------------------------------------------------- realtime + pages
async def ws_endpoint(ws: WebSocket):
    u = verify_token(ws.query_params.get("token", ""))
    if not u:
        await ws.close(code=4401)
        return
    await hub.connect(ws, u["id"])
    try:
        await ws.send_json({"type": "hello", "online": len(hub.conns)})
        while True:
            await ws.receive_text()  # keep-alive pings from the client
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.drop(ws)


async def index(request):
    return FileResponse(BASE / "static" / "index.html", headers={"Cache-Control": "no-cache"})


async def api_error(request, exc):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


async def server_error(request, exc):
    return JSONResponse({"detail": "Server error - please try again"}, status_code=500)


init_db()
routes = [
    Route("/", index),
    Route("/api/health", health),
    Route("/api/login", login, methods=["POST"]),
    Route("/api/login-options", login_options),
    Route("/api/me", me),
    Route("/api/state", state),
    Route("/api/templates", templates),
    Route("/api/projects", create_project, methods=["POST"]),
    Route("/api/projects/{pid}", delete_project, methods=["DELETE"]),
    Route("/api/projects/{pid}/tasks", add_task, methods=["POST"]),
    Route("/api/tasks/{tid}/assign", assign, methods=["PATCH"]),
    Route("/api/tasks/{tid}/reopen", reopen, methods=["POST"]),
    Route("/api/tasks/{tid}/start", start, methods=["POST"]),
    Route("/api/tasks/{tid}/progress", progress, methods=["POST"]),
    Route("/api/tasks/{tid}/report", report, methods=["POST"]),
    Route("/api/reports/{rid}/review", review, methods=["POST"]),
    WebSocketRoute("/ws", ws_endpoint),
    Mount("/static", StaticFiles(directory=str(BASE / "static")), name="static"),
    Mount("/uploads", StaticFiles(directory=str(UPLOADS)), name="uploads"),
]
app = Starlette(routes=routes, exception_handlers={HTTPException: api_error, 500: server_error})
