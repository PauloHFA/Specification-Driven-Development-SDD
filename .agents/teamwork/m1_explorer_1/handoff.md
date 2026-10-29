# Technical Exploration & Implementation Blueprint: 3D Math & Camera Kinematics (Milestone 1)

**Agent**: `m1_explorer_1`  
**Working Directory**: `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\m1_explorer_1`  
**Date**: 2026-10-28T15:45:00Z  
**Module Scope**: 
- `src/vault/math/vector3.js` (F1: Vector3 Primitive & 3D Math Operations)
- `src/vault/math/camera-kinematics.js` (F2: Camera Navigation & Lerp Kinematics)
**Test Targets**:
- `test/vault/vector3.test.js`
- `test/vault/camera-kinematics.test.js`

---

## 1. Observation

### 1.1 Requirements from `ORIGINAL_REQUEST.md`
- **Line 5**: `"Construir o Cofre 3D de Documentação & Diagramas (Spatial Knowledge Graph), uma ferramenta interativa para visualização e navegação espacial de anotações técnicas, componentes de software e especificações do framework de SDD do projeto em um espaço vetorial 3D contínuo, servindo como uma vitrine de alto impacto visual com física elástica e detecção de dependências."`
- **Lines 11-12 (R1. Espaço Vetorial 3D e Navegação Espacial)**: `"Apresentar um ambiente 3D interativo e contínuo onde notas, componentes de software, snippets de código e especificações são dispostos espacialmente. O usuário deve conseguir navegar pelo espaço arrastando o plano 3D com o mouse/controles e alternar o foco entre elementos com transições de câmera suaves via interpolação matemática (lerp)."`
- **Lines 26-28 (Acceptance Criteria - Renderização 3D e Navegação)**:
  - `"O ambiente 3D renderiza no navegador permitindo a visualização de nós distribuídos no espaço tridimensional."`
  - `"A navegação por arrasto (pan/orbit/zoom) responde fluidamente às interações do mouse."`
  - `"A seleção ou transição de foco entre nós aciona movimento de câmera suave via interpolação matemática (lerp)."`
- **Line 40**: `"A suíte de testes automatizados executa e passa com sucesso..."`

### 1.2 Architectural Constraints from `PROJECT.md` & `ARQUITETURA.md`
- **`PROJECT.md` (Lines 4-8)**:
  - `"Headless Core Engine (src/vault/)": Pure ES Modules runnable directly in Node.js >= 18 with zero external runtime dependencies.`
  - Native `node:test` test runner (`node --test "test/vault/**/*.test.js"`).
- **`PROJECT.md` (Lines 74-79)**:
  - `src/vault/math/vector3.js`:
    `class Vector3 { constructor(x=0, y=0, z=0); clone(); copy(v); set(x, y, z); add(v); sub(v); multiplyScalar(s); divideScalar(s); dot(v); cross(v); length(); lengthSq(); distanceTo(v); normalize(); lerp(v, alpha); toArray(); static fromArray(arr); angleTo(v); clamp(min, max); }`
  - `src/vault/math/camera-kinematics.js`:
    `class CameraController { constructor(config={}); setTarget(targetVec3); orbit(deltaX, deltaY); pan(deltaX, deltaY); zoom(deltaY); transitionTo(newTarget, newDistance, durationMs); update(deltaSec); getState(); }`
- **`package.json`**: `"type": "module"`, `"engines": { "node": ">=18" }`, no production npm dependencies.

### 1.3 Survey Findings from `survey_explorer_2/handoff.md`
- Spherical coordinates $(r, \theta, \phi)$ with strict polar clamping $[\epsilon_{\phi}, \pi - \epsilon_{\phi}]$ ($\epsilon_{\phi} = 0.001$ rad) prevents gimbal lock and degenerate cross products.
- Distance-scaled pan using $s_{\text{pan}} = \frac{2 r \tan(\text{FOV}_y / 2)}{H_{\text{viewport}}}$ ensures 1:1 pixel drag fidelity.
- Logarithmic zoom using $r \leftarrow r \cdot e^{\Delta \cdot k}$ guarantees scale-invariant zooming without crashing into zero distance.
- Target focus transitions require **Spherical Linear Interpolation (Slerp) on direction vectors combined with Arc Lift** and **Quintic Ease-Out** ($E(u) = 1 - (1 - u)^5$), preventing straight-line camera clipping through dense graph clusters.

---

## 2. Logic Chain & Mathematical Modeling

### 2.1 Vector3 Formal Mathematical Modeling (`vector3.js`)

Continuous 3D Euclidean space $\mathbb{R}^3$ with standard basis $(\hat{\mathbf{i}}, \hat{\mathbf{j}}, \hat{\mathbf{k}})$:
$$\mathbf{v} = x\hat{\mathbf{i}} + y\hat{\mathbf{j}} + z\hat{\mathbf{k}} = [x, y, z]^T$$

#### 2.1.1 In-Place Chaining vs Immutability Performance Rationale
In high-frequency real-time loops (e.g. 60 FPS animation, physics simulation with $N=500$ nodes and $E=1000$ edges calculating Hooke springs and Coulomb repulsion):
- Generating new object instances on every vector addition produces $\sim 600,000$ allocations/sec, triggering aggressive V8 Garbage Collection pauses and frame drops.
- **Decision**: All transformation and arithmetic methods (`set`, `copy`, `add`, `sub`, `multiplyScalar`, `divideScalar`, `cross`, `normalize`, `lerp`, `clamp`, `negate`) mutate `this` in-place and return `this` (fluent API).
- Query methods (`length`, `lengthSq`, `distanceTo`, `distanceToSq`, `dot`, `angleTo`, `equals`) return scalar numbers or booleans.
- Allocation methods (`clone`, `Vector3.fromArray`) explicitly create new instances.

#### 2.1.2 Numerical Stability & Zero Division Guards
1. **Division by Scalar (`divideScalar(s)`)**:
   - If $|s| < 10^{-12}$ or $s$ is non-finite: instead of generating `Infinity` or `NaN`, set all components to `0` and return `this`.
   - Formula:
     $$\mathbf{v} \leftarrow \begin{cases} [0, 0, 0]^T & \text{if } |s| < 10^{-12} \text{ or } \text{isNaN}(s) \\ \mathbf{v} \cdot \frac{1}{s} & \text{otherwise} \end{cases}$$
2. **Normalization (`normalize()`)**:
   - Length $L = \sqrt{x^2 + y^2 + z^2} = \text{hypot}(x, y, z)$.
   - If $L < 10^{-12}$, set $\mathbf{v} \leftarrow [0, 0, 0]^T$.
   - Otherwise $\mathbf{v} \leftarrow \mathbf{v} / L$. This avoids the catastrophic $0/0 = \text{NaN}$ bug when normalizing rest positions or zero velocities.
3. **Hypotenuse Precision (`length()`, `distanceTo(v)`)**:
   - Use `Math.hypot(x, y, z)` instead of $\sqrt{x^2 + y^2 + z^2}$ to prevent IEEE 754 overflow ($x^2 > 1.79 \times 10^{308}$) or underflow on extreme coordinate boundaries.
4. **Angle Calculation (`angleTo(v)`)**:
   $$\cos\theta = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}$$
   - If $\|\mathbf{u}\| \|\mathbf{v}\| < 10^{-12}$, return $0$.
   - Floating-point drift can result in $\frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|} = 1.0000000000000002$ or $-1.0000000000000002$. Passing this to `Math.acos()` yields `NaN`!
   - Clamp the cosine strictly to $[-1.0, 1.0]$:
     $$\theta = \arccos\left(\max(-1.0, \min(1.0, \cos\theta))\right)$$
5. **Robust Component Sanitization**:
   - Constructor and `set(x, y, z)` sanitize non-numeric or non-finite inputs:
     $$x \leftarrow \text{Number.isFinite}(x) ? \text{Number}(x) : 0$$

---

### 2.2 Camera Kinematics Formal Modeling (`camera-kinematics.js`)

#### 2.2.1 Coordinate System & State Vectors
- Right-Handed Coordinate System:
  - $+X$ = Right
  - $+Y$ = Up
  - $+Z$ = Outward (towards viewer)
- Kinematic State:
  - Camera Position: $\mathbf{p}_{\text{cam}} = [x_c, y_c, z_c]^T$
  - Look-at Target: $\mathbf{t} = [x_t, y_t, z_t]^T$
  - World Up: $\mathbf{u}_{\text{world}} = [0, 1, 0]^T$
  - Offset Vector: $\mathbf{v} = \mathbf{p}_{\text{cam}} - \mathbf{t}$
  - Radius: $r = \|\mathbf{v}\|$
  - Azimuth Angle (Yaw): $\theta = \text{atan2}(v_x, v_z) \in [-\pi, \pi]$
  - Polar Angle (Pitch / Zenith): $\phi = \arccos\left(\text{clamp}\left(\frac{v_y}{r}, -1, 1\right)\right) \in [0, \pi]$

#### 2.2.2 Gimbal Lock Elimination via Strict Polar Clamping
When $\phi = 0$ (directly overhead at North pole) or $\phi = \pi$ (directly below at South pole):
- Viewing ray $\hat{\mathbf{f}} = \frac{\mathbf{t} - \mathbf{p}_{\text{cam}}}{r}$ becomes parallel to $\mathbf{u}_{\text{world}} = [0, 1, 0]^T$.
- Camera Right: $\hat{\mathbf{r}} = \frac{\hat{\mathbf{f}} \times \mathbf{u}_{\text{world}}}{\|\hat{\mathbf{f}} \times \mathbf{u}_{\text{world}}\|} = \frac{[0, 0, 0]^T}{0}$ (singular degenerate state).
- **Polar Clamping Invariant**:
  $$\phi \in [\epsilon_{\phi}, \pi - \epsilon_{\phi}], \quad \epsilon_{\phi} = 0.001 \text{ rad } (\approx 0.057^\circ)$$
  This guarantees $\sin\phi \ge \sin(0.001) > 0$ at all times, making $\hat{\mathbf{f}} \times \mathbf{u}_{\text{world}}$ strictly non-zero and mathematically immune to gimbal lock.

#### 2.2.3 Orbit Kinematics
For mouse dragging deltas $(\Delta x, \Delta y)$:
$$\theta \leftarrow \theta - \Delta x \cdot k_{\text{orbit}} \cdot \left(\frac{2\pi}{W_{\text{viewport}}}\right)$$
$$\phi \leftarrow \text{clamp}\left(\phi - \Delta y \cdot k_{\text{orbit}} \cdot \left(\frac{\pi}{H_{\text{viewport}}}\right), \epsilon_{\phi}, \pi - \epsilon_{\phi}\right)$$
Cartesian re-projection from spherical coordinates:
$$\mathbf{p}_{\text{cam}} = \mathbf{t} + \begin{bmatrix} r \sin\phi \sin\theta \\ r \cos\phi \\ r \sin\phi \cos\theta \end{bmatrix}$$

#### 2.2.4 Distance-Scaled Planar Pan Kinematics
Panning moves both $\mathbf{p}_{\text{cam}}$ and $\mathbf{t}$ coplanarly in the screen projection plane perpendicular to the viewing ray:
1. Compute orthonormal camera basis:
   $$\hat{\mathbf{f}} = \text{normalize}(\mathbf{t} - \mathbf{p}_{\text{cam}})$$
   $$\hat{\mathbf{r}} = \text{normalize}(\hat{\mathbf{f}} \times \mathbf{u}_{\text{world}})$$
   $$\hat{\mathbf{u}} = \hat{\mathbf{r}} \times \hat{\mathbf{f}}$$
2. Perspective frustum scale factor at distance $r$:
   $$s_{\text{pan}} = \frac{2 \cdot r \cdot \tan(\text{FOV}_y / 2)}{H_{\text{viewport}}} \cdot k_{\text{pan}}$$
3. Translation offset vector:
   $$\Delta \mathbf{p} = -\Delta x \cdot s_{\text{pan}} \cdot \hat{\mathbf{r}} + \Delta y \cdot s_{\text{pan}} \cdot \hat{\mathbf{u}}$$
4. Synchronized shift:
   $$\mathbf{t} \leftarrow \mathbf{t} + \Delta \mathbf{p}, \quad \mathbf{p}_{\text{cam}} \leftarrow \mathbf{p}_{\text{cam}} + \Delta \mathbf{p}$$

#### 2.2.5 Logarithmic Dolly Zoom Kinematics
To preserve scale-invariant sensitivity across both macro distance ($r = 3000$) and micro inspection ($r = 15$):
$$r \leftarrow \text{clamp}\left(r \cdot \exp\left(\Delta y \cdot k_{\text{zoom}}\right), r_{\min}, r_{\max}\right)$$
where $k_{\text{zoom}} = 0.0015$, $r_{\min} = 5.0$, $r_{\max} = 8000.0$.
$$\mathbf{p}_{\text{cam}} = \mathbf{t} - r \hat{\mathbf{f}}$$

#### 2.2.6 Slerp + Arc Lerp Transition with Quintic Ease-Out
When user selects a node $B$ at $\mathbf{p}_B$:
- Start state at $t = 0$:
  - Start target: $\mathbf{t}_0 = \mathbf{t}_{\text{current}}$
  - Start offset: $\mathbf{v}_0 = \mathbf{p}_{\text{cam}, 0} - \mathbf{t}_0$, start distance $r_0 = \|\mathbf{v}_0\|$, unit direction $\hat{\mathbf{d}}_0 = \mathbf{v}_0 / r_0$.
- End state at $t = T$:
  - End target: $\mathbf{t}_1 = \mathbf{p}_B$
  - Desired distance: $r_1$ (e.g. $120.0$ units)
  - End direction: $\hat{\mathbf{d}}_1 = \hat{\mathbf{d}}_0$ (preserves user's current azimuth and elevation angle relative to target) or explicit orientation.
- Normalized time progress:
  $$u = \text{clamp}\left(\frac{t - t_0}{T}, 0, 1\right)$$
- **Quintic Ease-Out Formulation**:
  $$E(u) = 1 - (1 - u)^5$$
  - $E(0) = 0$, $E'(0) = 5$ (immediate responsiveness).
  - $E(1) = 1$, $E'(1) = 0$, $E''(1) = 0$, $E'''(1) = 0$ (asymptotically zero velocity, acceleration, and jerk — silky settling).
- **Target Linear Interpolation**:
  $$\mathbf{t}(u) = (1 - E(u)) \mathbf{t}_0 + E(u) \mathbf{t}_1$$
- **Direction Spherical Linear Interpolation (Slerp)**:
  Let $\cos\Omega = \text{clamp}(\hat{\mathbf{d}}_0 \cdot \hat{\mathbf{d}}_1, -1, 1)$, $\Omega = \arccos(\cos\Omega)$.
  $$\hat{\mathbf{d}}(u) = \begin{cases}
  \text{normalize}((1 - E(u))\hat{\mathbf{d}}_0 + E(u)\hat{\mathbf{d}}_1) & \text{if } \sin\Omega < 10^{-4} \\
  \frac{\sin((1 - E(u))\Omega)}{\sin\Omega}\hat{\mathbf{d}}_0 + \frac{\sin(E(u)\Omega)}{\sin\Omega}\hat{\mathbf{d}}_1 & \text{otherwise}
  \end{cases}$$
- **Radius with Arc Lift**:
  Linear interpolation through the direct vector path often clips through graph clusters situated between node $A$ and node $B$.
  Adding a parabolic/sinusoidal vertical arc lift expands camera clearance:
  $$r(u) = (1 - E(u)) r_0 + E(u) r_1 + A_{\text{arc}} \cdot \sin(\pi u)$$
  where $A_{\text{arc}} = \min(80.0, 0.25 \cdot \|\mathbf{t}_1 - \mathbf{t}_0\|)$.
  At $u=0$ and $u=1$, $\sin(\pi u) = 0$, leaving start and end distances exact. At $u=0.5$, $\sin(\pi u) = 1$, granting peak clearance.
- **Computed Camera Position**:
  $$\mathbf{p}_{\text{cam}}(u) = \mathbf{t}(u) + r(u) \hat{\mathbf{d}}(u)$$

---

## 3. Caveats & Assumptions

1. **Precision Limits of IEEE 754 Floats**:
   - Angle calculations (`Math.acos`) and dot products must be clamped to $[-1, 1]$. Omitting this will inevitably crash or produce `NaN` during long-running sessions due to float accumulation.
2. **Animation Frame Delta Variability**:
   - `deltaSec` passed to `update(deltaSec)` may fluctuate in real browsers (e.g. 16.6ms on 60Hz, 8.3ms on 120Hz, or several seconds if user minimizes tab).
   - Time accumulation must clamp delta increments (e.g. `Math.min(deltaSec, 0.1)`) so tab-switching does not produce math overflow.
3. **User Interaction During Active Transition**:
   - If the user clicks and drags (orbit, pan, or zoom) while a camera transition is underway, the transition must immediately and gracefully terminate at the current interpolated position rather than fighting user input or jumping back.
4. **Three.js Interoperability**:
   - All Vector3 methods and CameraController state structures must match standard Three.js naming (`x, y, z`, `clone`, `copy`, `set`, `add`, `sub`, `multiplyScalar`, `divideScalar`, `dot`, `cross`, `length`, `normalize`, `lerp`, `toArray`, `fromArray`) to ensure zero-cost translation between headless core and browser WebGL.
5. **No External Dependencies**:
   - All modules must be 100% self-contained pure ESM, runnable without DOM or WebGL in Node.js.

---

## 4. Conclusion & Implementation Blueprint

### 4.1 Exact Specifications for `src/vault/math/vector3.js`

#### Export Summary
```javascript
export class Vector3 { ... }
export function clamp(val, min, max) { ... }
export function lerp(start, end, alpha) { ... }
```

#### Detailed Method Contract Matrix
| Method | Arguments | Return Type | Mutates `this`? | Description & Stability Guard |
|---|---|---|---|---|
| `constructor(x=0, y=0, z=0)` | `(number, number, number)` | `Vector3` | Yes | Sanitizes non-finite inputs to `0`. |
| `set(x, y, z)` | `(number, number, number)` | `this` | Yes | Sets $x, y, z$, defaults omitted args to 0. |
| `clone()` | None | `Vector3` | No | Allocates new Vector3 with identical components. |
| `copy(v)` | `(Vector3 \| {x, y, z})` | `this` | Yes | Copies $x, y, z$ from source object. |
| `add(v)` | `(Vector3 \| {x, y, z})` | `this` | Yes | Vector addition: $x \leftarrow x + v.x$, etc. |
| `sub(v)` | `(Vector3 \| {x, y, z})` | `this` | Yes | Vector subtraction: $x \leftarrow x - v.x$, etc. |
| `addVectors(a, b)` | `(Vector3, Vector3)` | `this` | Yes | Sets this to $\mathbf{a} + \mathbf{b}$. |
| `subVectors(a, b)` | `(Vector3, Vector3)` | `this` | Yes | Sets this to $\mathbf{a} - \mathbf{b}$. |
| `multiplyScalar(s)` | `(number)` | `this` | Yes | Component-wise scalar multiplication. Non-finite $s \to 0$. |
| `divideScalar(s)` | `(number)` | `this` | Yes | **Zero Guard**: If $\|s\| < 10^{-12}$ or non-finite, sets to $(0,0,0)$. |
| `dot(v)` | `(Vector3)` | `number` | No | Algebraic dot product $x v_x + y v_y + z v_z$. |
| `cross(v)` | `(Vector3)` | `this` | Yes | Vector cross product $\mathbf{this} \times \mathbf{v}$. |
| `crossVectors(a, b)` | `(Vector3, Vector3)` | `this` | Yes | Sets this to $\mathbf{a} \times \mathbf{b}$. |
| `lengthSq()` | None | `number` | No | $x^2 + y^2 + z^2$. |
| `length()` | None | `number` | No | `Math.hypot(x, y, z)` avoiding overflow. |
| `distanceToSq(v)` | `(Vector3)` | `number` | No | Squared Euclidean distance to $\mathbf{v}$. |
| `distanceTo(v)` | `(Vector3)` | `number` | No | `Math.hypot(x - v.x, y - v.y, z - v.z)`. |
| `normalize()` | None | `this` | Yes | **Zero Guard**: If length $< 10^{-12}$, sets to $(0,0,0)$. |
| `lerp(v, alpha)` | `(Vector3, number)` | `this` | Yes | Linear interpolation: $\mathbf{this} + (\mathbf{v} - \mathbf{this}) \alpha$. |
| `lerpVectors(v1, v2, alpha)` | `(Vector3, Vector3, number)` | `this` | Yes | Sets this to lerp between $\mathbf{v}_1$ and $\mathbf{v}_2$. |
| `angleTo(v)` | `(Vector3)` | `number` | No | **Stability Guard**: Cosine clamped to $[-1, 1]$, zero guard if length $= 0$. |
| `clamp(min, max)` | `(Vector3\|number, Vector3\|number)` | `this` | Yes | Clamps components between bounds. |
| `negate()` | None | `this` | Yes | Inverts signs: $x \leftarrow -x, y \leftarrow -y, z \leftarrow -z$. |
| `equals(v, epsilon=1e-6)` | `(Vector3, number)` | `boolean` | No | Checks floating-point equality within epsilon. |
| `toArray(arr=[], offset=0)` | `(Array, number)` | `Array` | No | Serializes to array $[x, y, z]$. |
| `static fromArray(arr, offset=0)`| `(Array, number)` | `Vector3` | No | Factory creating new Vector3 from array elements. |

#### Complete Code Blueprint for `src/vault/math/vector3.js`
```javascript
/**
 * Vector3 - Pure ESM 3D Continuous Vector Arithmetic Primitive
 * Fully decoupled, zero-dependency, numerical stability guarded.
 */

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

export class Vector3 {
  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [z=0]
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number.isFinite(x) ? Number(x) : 0;
    this.y = Number.isFinite(y) ? Number(y) : 0;
    this.z = Number.isFinite(z) ? Number(z) : 0;
  }

  set(x = 0, y = 0, z = 0) {
    this.x = Number.isFinite(x) ? Number(x) : 0;
    this.y = Number.isFinite(y) ? Number(y) : 0;
    this.z = Number.isFinite(z) ? Number(z) : 0;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v) {
    if (!v) return this.set(0, 0, 0);
    this.x = Number.isFinite(v.x) ? Number(v.x) : 0;
    this.y = Number.isFinite(v.y) ? Number(v.y) : 0;
    this.z = Number.isFinite(v.z) ? Number(v.z) : 0;
    return this;
  }

  add(v) {
    if (v) {
      this.x += Number(v.x) || 0;
      this.y += Number(v.y) || 0;
      this.z += Number(v.z) || 0;
    }
    return this;
  }

  sub(v) {
    if (v) {
      this.x -= Number(v.x) || 0;
      this.y -= Number(v.y) || 0;
      this.z -= Number(v.z) || 0;
    }
    return this;
  }

  addVectors(a, b) {
    this.x = (Number(a?.x) || 0) + (Number(b?.x) || 0);
    this.y = (Number(a?.y) || 0) + (Number(b?.y) || 0);
    this.z = (Number(a?.z) || 0) + (Number(b?.z) || 0);
    return this;
  }

  subVectors(a, b) {
    this.x = (Number(a?.x) || 0) - (Number(b?.x) || 0);
    this.y = (Number(a?.y) || 0) - (Number(b?.y) || 0);
    this.z = (Number(a?.z) || 0) - (Number(b?.z) || 0);
    return this;
  }

  multiplyScalar(s) {
    const num = Number(s);
    if (!Number.isFinite(num)) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      return this;
    }
    this.x *= num;
    this.y *= num;
    this.z *= num;
    return this;
  }

  divideScalar(s) {
    const num = Number(s);
    if (!Number.isFinite(num) || Math.abs(num) < 1e-12) {
      // Guard against zero division / Infinity / NaN
      this.x = 0;
      this.y = 0;
      this.z = 0;
      return this;
    }
    const inv = 1 / num;
    this.x *= inv;
    this.y *= inv;
    this.z *= inv;
    return this;
  }

  dot(v) {
    if (!v) return 0;
    return this.x * (Number(v.x) || 0) +
           this.y * (Number(v.y) || 0) +
           this.z * (Number(v.z) || 0);
  }

  cross(v) {
    return this.crossVectors(this, v);
  }

  crossVectors(a, b) {
    const ax = Number(a?.x) || 0, ay = Number(a?.y) || 0, az = Number(a?.z) || 0;
    const bx = Number(b?.x) || 0, by = Number(b?.y) || 0, bz = Number(b?.z) || 0;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  distanceToSq(v) {
    const dx = this.x - (Number(v?.x) || 0);
    const dy = this.y - (Number(v?.y) || 0);
    const dz = this.z - (Number(v?.z) || 0);
    return dx * dx + dy * dy + dz * dz;
  }

  distanceTo(v) {
    return Math.hypot(
      this.x - (Number(v?.x) || 0),
      this.y - (Number(v?.y) || 0),
      this.z - (Number(v?.z) || 0)
    );
  }

  normalize() {
    const len = this.length();
    if (len < 1e-12) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      return this;
    }
    return this.divideScalar(len);
  }

  lerp(v, alpha) {
    const a = Number(alpha) || 0;
    this.x += ((Number(v?.x) || 0) - this.x) * a;
    this.y += ((Number(v?.y) || 0) - this.y) * a;
    this.z += ((Number(v?.z) || 0) - this.z) * a;
    return this;
  }

  lerpVectors(v1, v2, alpha) {
    const a = Number(alpha) || 0;
    const x1 = Number(v1?.x) || 0, y1 = Number(v1?.y) || 0, z1 = Number(v1?.z) || 0;
    const x2 = Number(v2?.x) || 0, y2 = Number(v2?.y) || 0, z2 = Number(v2?.z) || 0;
    this.x = x1 + (x2 - x1) * a;
    this.y = y1 + (y2 - y1) * a;
    this.z = z1 + (z2 - z1) * a;
    return this;
  }

  angleTo(v) {
    const lenProduct = this.length() * (v?.length ? v.length() : Math.hypot(v?.x || 0, v?.y || 0, v?.z || 0));
    if (lenProduct < 1e-12) return 0;
    const cosVal = this.dot(v) / lenProduct;
    // Strict clamp to [-1, 1] avoiding Math.acos NaN
    return Math.acos(clamp(cosVal, -1, 1));
  }

  clamp(min, max) {
    const minX = typeof min === 'number' ? min : (Number(min?.x) || -Infinity);
    const minY = typeof min === 'number' ? min : (Number(min?.y) || -Infinity);
    const minZ = typeof min === 'number' ? min : (Number(min?.z) || -Infinity);

    const maxX = typeof max === 'number' ? max : (Number(max?.x) || Infinity);
    const maxY = typeof max === 'number' ? max : (Number(max?.y) || Infinity);
    const maxZ = typeof max === 'number' ? max : (Number(max?.z) || Infinity);

    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
    this.z = Math.max(minZ, Math.min(maxZ, this.z));
    return this;
  }

  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  equals(v, epsilon = 1e-6) {
    if (!v) return false;
    return (
      Math.abs(this.x - (Number(v.x) || 0)) <= epsilon &&
      Math.abs(this.y - (Number(v.y) || 0)) <= epsilon &&
      Math.abs(this.z - (Number(v.z) || 0)) <= epsilon
    );
  }

  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }

  static fromArray(arr, offset = 0) {
    if (!Array.isArray(arr)) return new Vector3(0, 0, 0);
    return new Vector3(
      arr[offset] ?? 0,
      arr[offset + 1] ?? 0,
      arr[offset + 2] ?? 0
    );
  }
}
```

---

### 4.2 Exact Specifications for `src/vault/math/camera-kinematics.js`

#### Export Summary
```javascript
export class CameraController { ... }
export function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
export function slerpDirections(d0, d1, t) { ... }
```

#### Detailed Method Contract Matrix
| Method | Arguments | Return Type | Description & Behavior |
|---|---|---|---|
| `constructor(config={})` | `Object` | `CameraController` | Initializes camera position, target, spherical coordinates $(r, \theta, \phi)$, bounds, and sensitivities. |
| `setTarget(target, keepDistance=true)` | `(Vector3\|Array, boolean)` | `this` | Moves look-at target. If `keepDistance=true`, moves camera position along with target. |
| `setPosition(pos)` | `(Vector3\|Array)` | `this` | Updates camera position and recomputes spherical coordinates $(r, \theta, \phi)$ relative to target. |
| `orbit(deltaX, deltaY)` | `(number, number)` | `this` | Orbits camera around target. Clamps polar angle $\phi \in [\epsilon_{\phi}, \pi - \epsilon_{\phi}]$. Cancels active transition. |
| `pan(deltaX, deltaY)` | `(number, number)` | `this` | Moves camera and target in screen plane, scaled linearly by distance $r$. Cancels active transition. |
| `zoom(deltaY)` | `(number)` | `this` | Logarithmic exponential zoom: $r \leftarrow r \cdot e^{\Delta y \cdot k}$. Clamps to $[r_{\min}, r_{\max}]$. Cancels active transition. |
| `transitionTo(newTarget, newDistance=null, duration=0.8)` | `(Vector3\|Array, number\|null, number)` | `this` | Initiates smooth transition to new target and distance using Slerp direction interpolation and quintic ease-out. Handles duration in seconds or ms. |
| `cancelTransition()` | None | `this` | Halts transition in place, keeping current interpolated position and target. |
| `update(deltaSec)` | `(number)` | `boolean` | Steps kinematic transition animation by `deltaSec`. Returns `true` if transitioning, `false` if idle. |
| `getState()` | None | `Object` | Returns `{ position, target, up, forward, right, spherical, isTransitioning, progress }`. |

#### Complete Code Blueprint for `src/vault/math/camera-kinematics.js`
```javascript
/**
 * CameraController - Pure ESM 3D Camera Kinematics Engine
 * Implements Spherical Orbit with Gimbal Lock Protection,
 * Distance-Scaled Screen Pan, Logarithmic Zoom, and
 * Quintic Ease-Out Slerp + Arc Lerp Camera Transitions.
 */

import { Vector3, clamp } from './vector3.js';

export function easeOutQuint(t) {
  const clamped = clamp(t, 0, 1);
  return 1 - Math.pow(1 - clamped, 5);
}

/**
 * Spherical linear interpolation between two unit direction vectors.
 */
export function slerpDirections(d0, d1, t) {
  const dot = clamp(d0.dot(d1), -1, 1);
  const omega = Math.acos(dot);

  if (Math.sin(omega) < 1e-4) {
    // Nearly parallel or collinear: fallback to normalized linear lerp
    return new Vector3()
      .copy(d0)
      .multiplyScalar(1 - t)
      .add(new Vector3().copy(d1).multiplyScalar(t))
      .normalize();
  }

  const sinOmega = Math.sin(omega);
  const s0 = Math.sin((1 - t) * omega) / sinOmega;
  const s1 = Math.sin(t * omega) / sinOmega;

  return new Vector3()
    .copy(d0)
    .multiplyScalar(s0)
    .add(new Vector3().copy(d1).multiplyScalar(s1))
    .normalize();
}

export class CameraController {
  constructor(config = {}) {
    this.target = new Vector3();
    if (config.target) {
      if (Array.isArray(config.target)) this.target.set(...config.target);
      else this.target.copy(config.target);
    } else {
      this.target.set(0, 0, 0);
    }

    this.position = new Vector3();
    if (config.position) {
      if (Array.isArray(config.position)) this.position.set(...config.position);
      else this.position.copy(config.position);
    } else {
      this.position.set(0, 50, 200);
    }

    this.worldUp = new Vector3(0, 1, 0);
    this.fov = config.fov || 60; // vertical FOV in degrees
    this.viewportWidth = config.viewportWidth || 1920;
    this.viewportHeight = config.viewportHeight || 1080;

    // Bounds & Safeguards
    this.minDistance = config.minDistance ?? 5.0;
    this.maxDistance = config.maxDistance ?? 8000.0;
    this.minPolarAngle = config.minPolarAngle ?? 0.001; // epsilon to avoid gimbal lock
    this.maxPolarAngle = config.maxPolarAngle ?? (Math.PI - 0.001);

    // Sensitivities
    this.orbitSpeed = config.orbitSpeed ?? 1.0;
    this.panSpeed = config.panSpeed ?? 1.0;
    this.zoomSpeed = config.zoomSpeed ?? 0.0015;

    // Spherical state (radius, theta, phi)
    this.radius = 200;
    this.theta = 0;
    this.phi = Math.PI / 2;
    this._updateSphericalFromCartesian();

    // Transition state
    this._transition = {
      active: false,
      elapsed: 0,
      duration: 0.8,
      startTarget: new Vector3(),
      endTarget: new Vector3(),
      startDir: new Vector3(),
      endDir: new Vector3(),
      startDist: 200,
      endDist: 200,
      arcLift: 0
    };
  }

  _updateSphericalFromCartesian() {
    const offset = new Vector3().subVectors(this.position, this.target);
    this.radius = clamp(offset.length(), this.minDistance, this.maxDistance);

    if (this.radius < 1e-6) {
      this.radius = this.minDistance;
      offset.set(0, 0, this.radius);
    }

    // Azimuth theta: atan2(x, z)
    this.theta = Math.atan2(offset.x, offset.z);

    // Polar phi: acos(y / r)
    const cosPhi = clamp(offset.y / this.radius, -1, 1);
    this.phi = clamp(Math.acos(cosPhi), this.minPolarAngle, this.maxPolarAngle);
  }

  _updateCartesianFromSpherical() {
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    this.position.x = this.target.x + this.radius * sinPhi * sinTheta;
    this.position.y = this.target.y + this.radius * cosPhi;
    this.position.z = this.target.z + this.radius * sinPhi * cosTheta;
  }

  setTarget(target, keepDistance = true) {
    const newTarget = new Vector3();
    if (Array.isArray(target)) newTarget.set(...target);
    else newTarget.copy(target);

    if (keepDistance) {
      const delta = new Vector3().subVectors(newTarget, this.target);
      this.position.add(delta);
    }
    this.target.copy(newTarget);
    this._updateSphericalFromCartesian();
    return this;
  }

  setPosition(pos) {
    if (Array.isArray(pos)) this.position.set(...pos);
    else this.position.copy(pos);
    this._updateSphericalFromCartesian();
    return this;
  }

  orbit(deltaX, deltaY) {
    if (this._transition.active) this.cancelTransition();
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return this;

    const factorX = (2 * Math.PI) / this.viewportWidth;
    const factorY = Math.PI / this.viewportHeight;

    this.theta -= deltaX * factorX * this.orbitSpeed;
    this.phi -= deltaY * factorY * this.orbitSpeed;

    // Strict polar clamping to prevent gimbal lock
    this.phi = clamp(this.phi, this.minPolarAngle, this.maxPolarAngle);

    this._updateCartesianFromSpherical();
    return this;
  }

  pan(deltaX, deltaY) {
    if (this._transition.active) this.cancelTransition();
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return this;

    const forward = new Vector3().subVectors(this.target, this.position).normalize();
    let right = new Vector3().crossVectors(forward, this.worldUp).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const up = new Vector3().crossVectors(right, forward).normalize();

    // Distance-scaled pan
    const fovRad = (this.fov * Math.PI) / 180;
    const panScale = ((2 * this.radius * Math.tan(fovRad / 2)) / this.viewportHeight) * this.panSpeed;

    const panOffset = new Vector3()
      .copy(right)
      .multiplyScalar(-deltaX * panScale)
      .add(new Vector3().copy(up).multiplyScalar(deltaY * panScale));

    this.target.add(panOffset);
    this.position.add(panOffset);
    return this;
  }

  zoom(deltaY) {
    if (this._transition.active) this.cancelTransition();
    if (!Number.isFinite(deltaY)) return this;

    // Logarithmic / Exponential zoom
    const zoomFactor = Math.exp(deltaY * this.zoomSpeed);
    this.radius = clamp(this.radius * zoomFactor, this.minDistance, this.maxDistance);

    this._updateCartesianFromSpherical();
    return this;
  }

  transitionTo(newTarget, newDistance = null, duration = 0.8) {
    const endTarget = new Vector3();
    if (Array.isArray(newTarget)) endTarget.set(...newTarget);
    else endTarget.copy(newTarget);

    let durationSec = Number(duration) || 0.8;
    // Handle milliseconds input seamlessly
    if (durationSec > 10) durationSec /= 1000;

    if (durationSec <= 0) {
      // Instant snap
      this.target.copy(endTarget);
      if (newDistance !== null) this.radius = clamp(newDistance, this.minDistance, this.maxDistance);
      this._updateCartesianFromSpherical();
      this._transition.active = false;
      return this;
    }

    const startOffset = new Vector3().subVectors(this.position, this.target);
    const startDist = clamp(startOffset.length(), this.minDistance, this.maxDistance);
    const startDir = startOffset.clone().normalize();

    const endDist = newDistance !== null
      ? clamp(newDistance, this.minDistance, this.maxDistance)
      : startDist;

    // Retain direction or slight camera orbit orientation
    const endDir = startDir.clone();

    // Arc lift height proportional to distance between targets
    const targetDist = this.target.distanceTo(endTarget);
    const arcLift = Math.min(80.0, 0.25 * targetDist);

    this._transition = {
      active: true,
      elapsed: 0,
      duration: durationSec,
      startTarget: this.target.clone(),
      endTarget,
      startDir,
      endDir,
      startDist,
      endDist,
      arcLift
    };

    return this;
  }

  cancelTransition() {
    this._transition.active = false;
    this._updateSphericalFromCartesian();
    return this;
  }

  update(deltaSec) {
    if (!this._transition.active) return false;

    const dt = Math.max(0, Math.min(Number(deltaSec) || 0, 0.1));
    this._transition.elapsed += dt;

    const u = clamp(this._transition.elapsed / this._transition.duration, 0, 1);
    const ease = easeOutQuint(u);

    // 1. Target Lerp
    this.target.lerpVectors(this._transition.startTarget, this._transition.endTarget, ease);

    // 2. Direction Slerp
    const curDir = slerpDirections(this._transition.startDir, this._transition.endDir, ease);

    // 3. Radius Arc Lerp
    const curDist = lerp(this._transition.startDist, this._transition.endDist, ease) +
      this._transition.arcLift * Math.sin(Math.PI * u);

    this.radius = curDist;
    this.position.copy(this.target).add(curDir.multiplyScalar(curDist));
    this._updateSphericalFromCartesian();

    if (u >= 1) {
      this._transition.active = false;
    }

    return true;
  }

  getState() {
    const forward = new Vector3().subVectors(this.target, this.position).normalize();
    let right = new Vector3().crossVectors(forward, this.worldUp).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const up = new Vector3().crossVectors(right, forward).normalize();

    return {
      position: this.position.clone(),
      target: this.target.clone(),
      up,
      forward,
      right,
      spherical: {
        radius: this.radius,
        theta: this.theta,
        phi: this.phi
      },
      isTransitioning: this._transition.active,
      progress: this._transition.active
        ? clamp(this._transition.elapsed / this._transition.duration, 0, 1)
        : 1.0
    };
  }
}
```

---

## 5. Verification Method

### 5.1 Verification Test Commands
Run the Node.js native test runner against the target test files:
```powershell
node --test test/vault/vector3.test.js
node --test test/vault/camera-kinematics.test.js
```
Full vault suite run:
```powershell
node --test "test/vault/**/*.test.js"
```

### 5.2 Unit Test Matrix for `test/vault/vector3.test.js`

```javascript
// Verification Test Suite: test/vault/vector3.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, clamp, lerp } from '../../src/vault/math/vector3.js';

test('T1.1: Vector3 constructor defaults to (0,0,0) and accepts parameters', () => {
  const v1 = new Vector3();
  assert.equal(v1.x, 0);
  assert.equal(v1.y, 0);
  assert.equal(v1.z, 0);

  const v2 = new Vector3(3, -4, 5.5);
  assert.equal(v2.x, 3);
  assert.equal(v2.y, -4);
  assert.equal(v2.z, 5.5);
});

test('T1.2: Basic arithmetic operations (add, sub, multiplyScalar, divideScalar)', () => {
  const v = new Vector3(1, 2, 3);
  v.add(new Vector3(4, 5, 6));
  assert.deepEqual([v.x, v.y, v.z], [5, 7, 9]);

  v.sub(new Vector3(1, 1, 1));
  assert.deepEqual([v.x, v.y, v.z], [4, 6, 8]);

  v.multiplyScalar(2);
  assert.deepEqual([v.x, v.y, v.z], [8, 12, 16]);

  v.divideScalar(4);
  assert.deepEqual([v.x, v.y, v.z], [2, 3, 4]);
});

test('T1.3: Dot and Cross products satisfy mathematical invariants', () => {
  const i = new Vector3(1, 0, 0);
  const j = new Vector3(0, 1, 0);
  assert.equal(i.dot(j), 0); // Orthogonal dot = 0

  const k = new Vector3().crossVectors(i, j);
  assert.deepEqual([k.x, k.y, k.z], [0, 0, 1]); // i x j = k
});

test('T1.4: Length, distance and normalization calculations', () => {
  const v = new Vector3(3, 4, 0);
  assert.equal(v.lengthSq(), 25);
  assert.equal(v.length(), 5);

  const dist = v.distanceTo(new Vector3(0, 0, 0));
  assert.equal(dist, 5);

  v.normalize();
  assert.equal(Math.abs(v.length() - 1.0) < 1e-6, true);
});

test('T1.5: Linear interpolation (lerp) contracts', () => {
  const v1 = new Vector3(0, 0, 0);
  const v2 = new Vector3(10, 20, 30);
  v1.lerp(v2, 0.5);
  assert.deepEqual([v1.x, v1.y, v1.z], [5, 10, 15]);
});

test('T1.6: Serialization toArray and fromArray', () => {
  const v = new Vector3(1.5, 2.5, 3.5);
  assert.deepEqual(v.toArray(), [1.5, 2.5, 3.5]);

  const reconstructed = Vector3.fromArray([1.5, 2.5, 3.5]);
  assert.equal(reconstructed.equals(v), true);
});

// Tier 2: Boundary & Corner Cases (Zero division & Numerical Stability)
test('T2.1: divideScalar(0) does not return NaN or Infinity', () => {
  const v = new Vector3(10, -20, 30);
  v.divideScalar(0);
  assert.equal(Number.isFinite(v.x), true);
  assert.equal(Number.isFinite(v.y), true);
  assert.equal(Number.isFinite(v.z), true);
  assert.deepEqual([v.x, v.y, v.z], [0, 0, 0]);
});

test('T2.2: normalize() on zero vector (0,0,0) returns (0,0,0) without NaN', () => {
  const v = new Vector3(0, 0, 0);
  v.normalize();
  assert.deepEqual([v.x, v.y, v.z], [0, 0, 0]);
  assert.equal(Number.isNaN(v.x), false);
});

test('T2.3: angleTo guards against numerical precision overflow (cos > 1.0)', () => {
  const v1 = new Vector3(1, 1, 1).normalize();
  const v2 = v1.clone();
  const angle = v1.angleTo(v2);
  assert.equal(Number.isNaN(angle), false);
  assert.equal(angle, 0);
});

test('T2.4: clamp method bounds vector coordinates', () => {
  const v = new Vector3(-10, 50, 100);
  v.clamp(0, 60);
  assert.deepEqual([v.x, v.y, v.z], [0, 50, 60]);
});

test('T2.5: Non-numeric / NaN input handling in constructor and set', () => {
  const v = new Vector3('invalid', null, undefined);
  assert.deepEqual([v.x, v.y, v.z], [0, 0, 0]);
});
```

### 5.3 Unit Test Matrix for `test/vault/camera-kinematics.test.js`

```javascript
// Verification Test Suite: test/vault/camera-kinematics.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraController, easeOutQuint, slerpDirections } from '../../src/vault/math/camera-kinematics.js';
import { Vector3 } from '../../src/vault/math/vector3.js';

test('T1.1: CameraController initial state and spherical conversion', () => {
  const cam = new CameraController({
    target: [0, 0, 0],
    position: [0, 0, 100]
  });
  const state = cam.getState();
  assert.equal(state.spherical.radius, 100);
  assert.equal(Math.abs(state.position.z - 100) < 1e-4, true);
  assert.equal(state.isTransitioning, false);
});

test('T1.2: Spherical orbit updates azimuth and elevation', () => {
  const cam = new CameraController({
    target: [0, 0, 0],
    position: [0, 0, 100],
    viewportWidth: 1000,
    viewportHeight: 1000
  });
  const initTheta = cam.theta;
  cam.orbit(100, 0);
  assert.notEqual(cam.theta, initTheta);
});

test('T1.3: Distance-scaled screen pan moves target and position synchronously', () => {
  const cam = new CameraController({
    target: [0, 0, 0],
    position: [0, 0, 100]
  });
  const oldPos = cam.position.clone();
  const oldTarget = cam.target.clone();
  cam.pan(50, 50);

  // Offset between position and target must remain identical
  const distBefore = oldPos.distanceTo(oldTarget);
  const distAfter = cam.position.distanceTo(cam.target);
  assert.equal(Math.abs(distBefore - distAfter) < 1e-4, true);
  assert.notEqual(cam.target.x, oldTarget.x);
});

test('T1.4: Logarithmic zoom scales distance exponentially', () => {
  const cam = new CameraController({
    target: [0, 0, 0],
    position: [0, 0, 100]
  });
  cam.zoom(100); // Zoom out
  assert.equal(cam.radius > 100, true);

  cam.zoom(-200); // Zoom in
  assert.equal(cam.radius < 100, true);
});

test('T1.5: Slerp + Arc Lerp transition executes quintic ease-out to new node target', () => {
  const cam = new CameraController({
    target: [0, 0, 0],
    position: [0, 0, 100]
  });
  const newTarget = new Vector3(300, 100, -200);
  cam.transitionTo(newTarget, 150, 0.5);

  assert.equal(cam.getState().isTransitioning, true);

  // Halfway through transition
  cam.update(0.25);
  const midState = cam.getState();
  assert.equal(midState.isTransitioning, true);
  assert.equal(midState.progress > 0 && midState.progress < 1, true);

  // Complete transition
  cam.update(0.30);
  const finalState = cam.getState();
  assert.equal(finalState.isTransitioning, false);
  assert.equal(finalState.target.equals(newTarget, 1e-3), true);
  assert.equal(Math.abs(finalState.spherical.radius - 150) < 1e-3, true);
});

// Tier 2: Boundary & Corner Cases
test('T2.1: Gimbal lock prevention under extreme orbit deltas', () => {
  const cam = new CameraController({
    target: [0, 0, 0],
    position: [0, 0, 100],
    viewportHeight: 500
  });

  // Attempt to drag pitch far above North Pole
  cam.orbit(0, 10000);
  assert.equal(cam.phi >= cam.minPolarAngle, true);

  // Attempt to drag pitch far below South Pole
  cam.orbit(0, -20000);
  assert.equal(cam.phi <= cam.maxPolarAngle, true);

  // Camera right vector must remain valid (not NaN or zero)
  const state = cam.getState();
  assert.equal(Number.isFinite(state.right.x), true);
  assert.equal(state.right.lengthSq() > 0.5, true);
});

test('T2.2: Zoom clamps strictly between minDistance and maxDistance', () => {
  const cam = new CameraController({
    minDistance: 10,
    maxDistance: 1000
  });
  cam.zoom(-100000); // Extreme zoom in
  assert.equal(cam.radius >= 10, true);

  cam.zoom(100000); // Extreme zoom out
  assert.equal(cam.radius <= 1000, true);
});

test('T2.3: User interaction interrupts active transition smoothly', () => {
  const cam = new CameraController();
  cam.transitionTo([100, 100, 100], 200, 1.0);
  cam.update(0.2);
  assert.equal(cam.getState().isTransitioning, true);

  // User drags orbit mid-transition
  cam.orbit(10, 10);
  assert.equal(cam.getState().isTransitioning, false);
});

test('T2.4: Zero-duration transition completes immediately without division by zero', () => {
  const cam = new CameraController();
  cam.transitionTo([50, 50, 50], 100, 0);
  assert.equal(cam.getState().isTransitioning, false);
  assert.equal(cam.target.equals(new Vector3(50, 50, 50)), true);
});
```

### 5.4 Invalidation Conditions
This technical specification is invalidated if:
1. `Vector3` or `CameraController` requires external runtime dependencies from npm (violating the project's zero-dependency standard).
2. `divideScalar(0)` or `normalize()` on a zero vector yields `NaN` or unhandled exceptions.
3. Orbiting over the poles generates gimbal lock (degenerate right vector or `NaN`).
4. `CameraController.transitionTo` produces straight-line paths clipping through dense graph centers instead of elevated cinematic arc curves.
5. The test suite fails when executed with native Node.js `node --test`.
