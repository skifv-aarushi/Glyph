# Glyph: Distributed Spatial Collaborative Code Engine

Glyph is an experimental distributed systems and computer graphics project that unifies a discrete text-buffer code editor (**Monaco / VS Code Editor Core**) with a continuous 2D affine vector canvas (**Tldraw**) at 60 frames per second. State convergence across spatial diagrams and code abstract syntax trees is maintained through conflict-free replicated data types (Yjs CRDTs), distributed mutex locks, and an isolated multi-language compiler pipeline.

## 1. System Architecture & Component Topology

Glyph divides responsibilities across three decoupled layers:

### A. Client Runtime (Browser)
* **Monaco Editor (Code Buffer)**: Virtualized DOM-based code editor handling raw text manipulation, syntax trees, and cursor tracking.
* **Tldraw Vector Canvas**: High-performance continuous 2D affine canvas rendering freeform vector graphics and spatial overlays.
* **Affine Projection Engine (60 FPS)**: Directly couples Monaco scroll events `(Sx, Sy)` to the Tldraw camera transform matrix on every render tick, eliminating phase lag.
* **Yjs CRDT Client (`Y.Doc`)**: Manages the local document state composed of a sequence CRDT (`Y.Text`) for code and a Last-Write-Wins map (`Y.Map`) for spatial vector shapes.
* **WebSocket Protocol Multiplexer**: Serializes JSON control events (cursor positions, lock states, execution requests) and binary Yjs CRDT differential update vectors over a single duplex connection.

### B. Stateful Backend Gateway (Node.js / Express / WS)
* **WebSocket Server (`/room/:roomId`)**: Ephemeral connection hub handling client handshakes, ping/pong heartbeats, and binary broadcast.
* **Session & RBAC State Machine (`RoomManager`)**: Enforces host privileges, guest permissions, room closure, and password authentication.
* **Distributed Mutex Service**: Manages Git push locks and collaborative write locks using time-bounded leases.
* **Compiler Dispatcher**: Routes multi-language source payloads to remote sandbox environments and streams back stdout/stderr diagnostics.
* **GitHub API Proxy**: Handles stateless Git tree commits, branch generation, and repository pushes on behalf of authenticated users.

### C. Infrastructure & Remote Providers
* **Upstash Redis**: Global distributed mutex coordination (`SET NX EX`) and cross-instance Pub/Sub messaging.
* **Wandbox Compiler Service**: Sandboxed multi-language remote code compilation across 19 compiler targets.
* **GitHub REST API v3**: Authenticated remote repository integration for zero-local-install commits.

```
Client Runtime (Monaco + Tldraw + Yjs)
        ▲
        │  Multiplexed Duplex WebSocket (Binary CRDT + JSON Control)
        ▼
Stateful Gateway (RoomManager + Mutex + Compilers + Git Proxy)
        ▲
        ├── Atomic Mutex (SET NX EX) ──────> Upstash Redis
        ├── JSON-RPC Code Execution ───────> Wandbox Compiler Service
        └── REST Commit & Push ─────────────> GitHub API v3
```

---

## 2. Mathematical & Algorithmic Specifications

### 2.1 Viewport Affine Coordinate Projection Math
Code editors model text in discrete topological coordinates $(L, C) \in \mathbb{N} \times \mathbb{N}$ (line index and column index), rendered via DOM virtualization. Spatial canvases operate in a continuous 2D Euclidean coordinate space $\mathbb{R}^2$.

To lock freeform vector annotations to code tokens without visual drift or frame-tearing during inertial kinetic scrolling, Glyph evaluates a direct affine coordinate projection on every browser rendering tick:

$$\begin{bmatrix} x_{\text{canvas}} \\ y_{\text{canvas}} \\ 1 \end{bmatrix} = \begin{bmatrix} 1 & 0 & -S_x \\ 0 & 1 & -S_y \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} x_{\text{editor}} \\ y_{\text{editor}} \\ 1 \end{bmatrix}$$

Where:
* $(S_x, S_y)$ are the horizontal and vertical scroll offsets reported by the Monaco virtualization controller (`getScrollLeft()`, `getScrollTop()`).
* For any token at document line $L$ and column $C$:
  $$y_{\text{editor}} = \text{lineTop}(L)$$
  $$x_{\text{editor}} = \text{contentLeft} + (C - 1) \cdot w_{\text{char}}$$
  *(with $w_{\text{char}} \approx 8.4\text{px}$ based on font metric rendering for monospace glyphs)*.
* Tldraw camera parameters are updated synchronously on `onDidScrollChange` without requestAnimationFrame queueing to prevent single-frame phase lag:
  $$\mathbf{C}_{\text{tldraw}} = \{ x: -\lfloor S_x \rfloor, \; y: -\lfloor S_y \rfloor, \; z: 1.0 \}$$

---

### 2.2 Replicated Data Types & Distributed Consensus
State replication across untrusted network nodes uses Conflict-Free Replicated Data Types (CRDTs):

```
                   ┌───────────────────────────────┐
                   │       Shared Y.Doc Root       │
                   └──────┬─────────────────┬──────┘
                          │                 │
            ┌─────────────┴──────┐   ┌──────┴────────────────────┐
            │ Y.Text ('monaco')  │   │ Y.Map ('tldraw')          │
            └────────────────────┘   └───────────────────────────┘
            Sequence CRDT (YATA)     LWW-Element-Set CRDT
            - O(log N) tree indexing - Key: Shape UUID
            - Concurrent char edits  - Value: Vector Shape Record
```

* **Text Buffer (`Y.Text`)**: Implements the YATA (Yet Another Transformation Approach) sequence CRDT algorithm. Concurrent character insertions and deletions converge deterministically across all nodes in $O(\log N)$ tree operations without central lock coordination.
* **Vector Shapes & Drawing Manifest (`Y.Map<TLRecord>`)**: Implements a Last-Write-Wins Element-Set (LWW-Element-Set) CRDT. Shape additions, affine transformations, and deletions are committed under discrete transaction origins (`tldraw-local`), eliminating mutation echo loops:
  $$\forall e_1, e_2 \in \text{Transactions}, \quad e_1 \prec e_2 \iff \text{lamport}(e_1) < \text{lamport}(e_2)$$
* **Differential State Vector Exchange**:
  1. Client sends state vector $V_A = \text{encodeStateVector}(Doc_A)$.
  2. Server calculates differential update slice $\Delta = \text{diff}(V_A, V_S)$.
  3. Server returns binary `UpdateV2` packet to synchronize state with zero redundant payload transfer.

---

### 2.3 Wire Protocol Multiplexing
WebSocket communication combines low-overhead binary CRDT payloads with high-level JSON control frames over a single bidirectional stream:

```
WebSocket Frame
├── Byte 0 == 0x7B ('{'): Intercept as UTF-8 JSON Control Frame
│   ├── auth_status: RBAC role ('host' | 'co-host' | 'guest' | 'spectator')
│   ├── session_mode: Mode transition ('open-sandbox' | 'lecture' | ...)
│   ├── role_update: Dynamic privilege elevation / revocation
│   ├── lock_status: Distributed mutex lock broadcasts
│   └── session_concluded: Room destruction and peer disconnection
└── Byte 0 != 0x7B: Forward directly to y-websocket binary decoder
    ├── Yjs SyncStep 1 (State Vector Exchange)
    ├── Yjs SyncStep 2 (Update Payloads)
    └── Yjs Awareness (Presence & Remote Cursor Coordinates)
```

---

### 2.4 Distributed Mutex & Concurrency Control
To prevent push collisions on remote Git branches when multiple collaborators are editing in the same room, atomic commits are guarded by a distributed Redis Mutex with leased TTLs:

1. **Acquisition**: Evaluates atomic key reservation with lease expiry:
   ```text
   SET lock:push:{roomId} <userId> NX EX 15
   ```
2. **Safe Release**: Prevents out-of-order unlock race conditions via atomic Lua evaluation:
   ```lua
   if redis.call("get", KEYS[1]) == ARGV[1] then
       return redis.call("del", KEYS[1])
   else
       return 0
   end
   ```
3. **Fault Tolerance**: If Redis is unreachable, the system automatically degrades to a localized in-memory timestamped lock table (`Map<string, { userId, expiresAt }>`).

---

### 2.5 Code Execution Pipeline & Diagnostic Coordinate Projection
Code execution uses a two-tier evaluation engine:

```
User triggers Run (Ctrl+Enter)
│
├── File extension in ['ts', 'tsx', 'js', 'jsx']?
│   ├── YES (Fast Path - Client JIT):
│   │   ├── Sucrase AST Transpilation (transforms: ['typescript', 'jsx', 'imports']) [~1.2ms]
│   │   ├── Instantiation of isolated asynchronous execution scope:
│   │   │   new AsyncFunction('console', 'require', 'module', 'exports', 'document', 'window', code)
│   │   └── Sandboxed DOM and CommonJS module shims
│   │
│   └── NO (Slow Path - Isolated Compiler Sandbox):
│       ├── REST Dispatch to Wandbox JSON-RPC compiler backend
│       ├── GCC Head / Clang / CPython / Rustc / Go compilation
│       └── Return stdout, stderr, exit code, and execution duration
│
└── Traceback Regex State Machine:
    ├── Extracts line L and column C from compiler diagnostics:
    │   - GCC/Clang:   /([^:\n]+):(\d+):(?:\d+:)?\s*error:\s*([^\n]+)/
    │   - Python:      /File\s+["'][^"']+["'],\s+line\s+(\d+).*?\n([A-Za-z]+Error:[^\n]+)/s
    │   - V8 / Node:   /at\s+.*?:(\d+):(\d+)\)?/
    │
    ├── Injects Monaco editor model markers (red underline at line L)
    └── Synthesizes spatial diagnostic card in Tldraw vector store at calculated coordinate (X, Y)
```

---

### 2.6 Local Storage Architecture & Memory Hierarchy
To handle multi-megabyte C/C++ projects with extensive header trees without browser storage quota crashes (`QuotaExceededError` at 5MB in `sessionStorage`):

```
Directory Drop (Drag-and-Drop)
│
├── webkitGetAsEntry() Recursive Directory Traversal
│   ├── Resolves FileSystemDirectoryReader batches (100 entries/chunk)
│   └── Traverses nested structures without dropping subdirectories
│
├── Multi-Tier Storage Hierarchy:
│   ├── Tier 1 (L1 In-Memory): Global in-memory Map<string, string> for synchronous read/write
│   ├── Tier 2 (L2 Client Persistence): IndexedDB database ('glyph_local_store')
│   │   └── Object store 'workspace_files' keyed by relative path (100MB+ storage capacity)
│   └── Tier 3 (L3 Cold Archiving): S3-compatible Supabase storage bucket ('ephemeral-sessions')
│       └── Triggered on room disconnection with 5-minute garbage collection countdown
```

---

## 3. State Machine & RBAC Specification

The room access controller evaluates a 2-dimensional permissions matrix across **User Roles** and **Session Modes**:

| Session Mode | Host Privilege | Co-Host Privilege | Guest Privilege | Spectator Privilege |
| :--- | :--- | :--- | :--- | :--- |
| **`open-sandbox`** | Code: `RW`<br>Canvas: `RW`<br>Admin: `Yes` | Code: `RW`<br>Canvas: `RW`<br>Admin: `No` | Code: `RW`<br>Canvas: `RW`<br>Admin: `No` | Code: `R`<br>Canvas: `R`<br>Admin: `No` |
| **`lecture`** | Code: `RW`<br>Canvas: `RW`<br>Admin: `Yes` | Code: `RW`<br>Canvas: `RW`<br>Admin: `No` | Code: `R`<br>Canvas: `R`<br>Admin: `No` | Code: `R`<br>Canvas: `R`<br>Admin: `No` |
| **`whiteboard`** | Code: `RW`<br>Canvas: `RW`<br>Admin: `Yes` | Code: `RW`<br>Canvas: `RW`<br>Admin: `No` | Code: `R`<br>Canvas: `RW`<br>Admin: `No` | Code: `R`<br>Canvas: `R`<br>Admin: `No` |
| **`code-review`** | Code: `R`<br>Canvas: `RW`<br>Admin: `Yes` | Code: `R`<br>Canvas: `RW`<br>Admin: `No` | Code: `R`<br>Canvas: `RW`<br>Admin: `No` | Code: `R`<br>Canvas: `R`<br>Admin: `No` |

### Host Migration Protocol
When a connected socket disconnects from a room:
1. If the disconnecting client was the designated `Host`, the room manager queries the active connection registry:
   $$u_{\text{next}} = \arg\min_{u \in \text{Users}} (u.\text{timestamp})$$
2. $u_{\text{next}}$ is atomically promoted to `Host` in the room session table and within the CRDT `room-settings` map.
3. A `HOST_MIGRATED` frame is broadcast to all remaining peer sockets.

---

## 4. Polyglot Compiler Support Matrix

| Language | Engine / Compiler Target | Standard / Target Environment | Traceback Parser |
| :--- | :--- | :--- | :---: |
| **C** | `gcc-head-c` | C17 / C2x | Native GCC |
| **C++** | `gcc-head` | C++20 / C++23 | Native GCC |
| **TypeScript** | `typescript-5.6.2` / Sucrase | ESNext / Node.js 20 | Sucrase / V8 |
| **JavaScript** | `nodejs-20.17.0` / In-Browser JIT | ECMAScript 2024 | V8 |
| **Python** | `cpython-3.12.7` | Python 3.12 | CPython |
| **Rust** | `rust-1.82.0` | Edition 2021 | Rustc |
| **Go** | `go-1.23.2` | Go 1.23 | Go Runtime |
| **Java** | `openjdk-jdk-22+36` | Java 22 | JVM |
| **C#** | `mono-6.12.0.199` | .NET / Mono | Mono |
| **Bash** | `bash` | POSIX Shell | GNU Bash |
| **Ruby** | `ruby-4.0.2` | Ruby 4.0 | MRI |
| **PHP** | `php-8.3.12` | PHP 8.3 | Zend |
| **Swift** | `swift-6.0.1` | Swift 6.0 | Swiftc |
| **Lua** | `lua-5.4.7` | Lua 5.4 | Lua VM |
| **Zig** | `zig-head` | Zig 0.14-dev | Zig Stage2 |
| **Nim** | `nim-2.2.10` | Nim 2.2 | Nim Compiler |
| **R** | `r-4.4.1` | GNU R | R Engine |
| **Perl** | `perl-5.44.0` | Perl 5.44 | Perl Interpreter |
| **SQL** | `sqlite-3.46.1` | SQLite 3 | SQLite C-Engine |

---

## 5. Monorepo Structure

```
Glyph/
├── apps/
│   ├── web/                          # Client Application (Next.js 14 App Router)
│   │   ├── src/
│   │   │   ├── app/                  # Route entry points (/, /editor, /room/[roomId])
│   │   │   ├── components/           # UI components (Canvas, Editor, Explorer, Modals)
│   │   │   ├── context/              # ThemeContext, YjsContext
│   │   │   ├── hooks/                # useYjsSync, useGitHubApi
│   │   │   ├── services/             # codeExecution (Sucrase JIT + Wandbox client)
│   │   │   └── utils/                # scrollBinding, themes, localWorkspaceStore
│   │   └── package.json
│   │
│   └── server/                       # State Machine & Synchronization Gateway (Node.js)
│       ├── src/
│       │   ├── auth/                 # OAuth authentication and JWT lifecycle
│       │   ├── config/               # Configuration and environment resolution
│       │   ├── github/               # GitHub REST API proxy handlers
│       │   ├── redis/                # Redis Pub/Sub and Mutex connection pools
│       │   ├── routes/               # REST controllers (/git, /compiler)
│       │   ├── services/             # gitPushService, compilerService, redisLock
│       │   ├── websocket/            # RoomManager, PubSubManager, WebSocket listener
│       │   └── index.ts              # HTTP & WebSocket bootstrap
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared type definitions and protocol contracts
│       ├── src/types.ts
│       └── package.json
│
├── .env.example                      # Canonical environment variable specification
├── package.json                      # Workspace root scripts
├── tsconfig.base.json                # Base TypeScript compiler configuration
└── turbo.json                        # Turborepo task graph pipeline
```

---

## 6. Build & Local Development

### Prerequisites
* **Runtime**: Node.js >= 20.0.0
* **Package Manager**: npm >= 10.0.0

### Setup
```bash
# Clone repository
git clone https://github.com/your-username/Glyph.git
cd Glyph

# Install workspace dependencies
npm install

# Initialize local environment variables
cp .env.example .env

# Start concurrent development runtimes
npm run dev
```

* **Frontend**: `http://localhost:3000`
* **WebSocket / REST Gateway**: `http://localhost:8080` (`ws://localhost:8080`)

### Verification
```bash
# Typecheck across all workspace packages
npm run lint

# Compile optimized production bundles
npm run build
```

---

## 7. Production Deployment Specification

Because Glyph maintains continuous stateful WebSocket connections for CRDT replication, the monorepo requires a decoupled deployment model:

```
Browser Client
   ├── HTTPS (Static / SSR Assets) ───────> Vercel (apps/web)
   └── WSS (Binary CRDT Stream / RPC) ───> Railway / Render / VPS (apps/server)
```

### 1. State Machine & WebSocket Gateway (`apps/server`)
* **Target Platforms**: Railway, Render, Fly.io, or AWS EC2 / Docker container.
* **Requirements**: Persistent TCP connectivity (serverless lambdas are incompatible with long-lived WebSockets).
* **Environment Configuration**:
  ```env
  PORT=8080
  NODE_ENV=production
  JWT_SECRET=<32_byte_cryptographic_secret>
  CLIENT_ORIGIN=https://<your_frontend_domain>.vercel.app
  REDIS_URL=redis://default:<password>@<endpoint>:6379
  ```

### 2. Frontend Application (`apps/web`)
* **Target Platform**: Vercel.
* **Framework Preset**: Next.js.
* **Root Directory**: `apps/web` (with *"Include files outside of the Root Directory in the Build Step"* enabled).
* **Environment Configuration**:
  ```env
  NEXT_PUBLIC_APP_URL=https://<your_frontend_domain>.vercel.app
  NEXT_PUBLIC_SERVER_URL=https://<your_backend_domain>.up.railway.app
  NEXT_PUBLIC_WS_SERVER_URL=wss://<your_backend_domain>.up.railway.app
  ```

---

## 8. License

Distributed under the MIT License. See [LICENSE](LICENSE) for terms.
