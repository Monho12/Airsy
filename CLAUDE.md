# CLAUDE.md — AERIS: Real-Time Smart Building Digital Twin

> **Single source of truth** for the AERIS project: vision, requirements, architecture, design system,
> workflow, and roadmap. Every contributor — human or AI — must read this file before doing project work.
>
> **Document status:** Phase 0 (Planning) — *draft awaiting developer review.*
> **No application code exists yet.** Do not begin Phase 1 until the developer explicitly approves this document.

---

## Progress Tracker

| Phase | Name | Status | Approved by developer |
|------:|------|--------|-----------------------|
| 0 | Planning (this document) | 🟡 In review | ☐ |
| 1 | Frontend foundation | ⚪ Not started | ☐ |
| 2 | Dashboard UI (mock data) | ⚪ Not started | ☐ |
| 3 | Interactive 3D building | ⚪ Not started | ☐ |
| 4 | Live sensor simulation | ⚪ Not started | ☐ |
| 5 | Automatic ventilation control | ⚪ Not started | ☐ |
| 6 | Scenarios, charts, and alerts | ⚪ Not started | ☐ |
| 7 | Quality and presentation | ⚪ Not started | ☐ |

Legend: ⚪ not started · 🟡 in progress / in review · 🟢 complete and approved · 🔴 blocked

Update this table at the end of every phase. A phase becomes 🟢 only after the developer approves it.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Users and Key Use Cases](#3-users-and-key-use-cases)
4. [Functional Requirements](#4-functional-requirements)
5. [Building and Sensor Specification](#5-building-and-sensor-specification)
6. [Automatic Control Logic](#6-automatic-control-logic)
7. [Demonstration Scenarios](#7-demonstration-scenarios)
8. [UX and Visual Design System](#8-ux-and-visual-design-system)
9. [Technical Architecture](#9-technical-architecture)
10. [Data Models](#10-data-models)
11. [Real-Time and Performance Strategy](#11-real-time-and-performance-strategy)
12. [Testing and Acceptance Criteria](#12-testing-and-acceptance-criteria)
13. [Phased Implementation Roadmap](#13-phased-implementation-roadmap)
14. [Development Workflow and Claude Code Rules](#14-development-workflow-and-claude-code-rules)
15. [Assumptions, Risks, and Future Extensions](#15-assumptions-risks-and-future-extensions)
- [Appendix A — Glossary](#appendix-a--glossary)
- [Appendix B — Decision Log](#appendix-b--decision-log)

---

## 1. Project Overview

**AERIS** is an interactive, real-time smart building monitoring and ventilation management web application.

It shows a **multi-floor building as a 3D digital twin**. Users can see environmental sensor readings per floor,
monitor indoor air quality (IAQ), watch simulated ventilation equipment respond, receive alerts when conditions
become abnormal, and read a plain-language explanation of **every automatic decision** the system makes.

### 1.1 Context

- Built as a **university Advanced Web Development project** by a single developer (a third-year AI/ML student
  learning full-stack web development through practical work).
- The initial version is a **polished, fully functional, frontend-only simulation**. It uses **no physical sensors
  and no production backend**.
- The architecture is designed so that a backend, real IoT sensors, and multiple concurrent users can be added
  later **without rewriting the application** (see §9.6 and §15.3).

### 1.2 What the project must demonstrate

- [ ] Real-time data updates (no page reloads).
- [ ] Interactive 3D visualization (orbit, zoom, floor and sensor selection).
- [ ] Responsive, professional UI design.
- [ ] Meaningful CSS and interface animation (purposeful, accessible, reduced-motion aware).
- [ ] Environmental monitoring and alert management.
- [ ] Automatic, rule-based ventilation control.
- [ ] Event history with transparent explanations of system decisions.
- [ ] Clean, maintainable architecture with tests.
- [ ] A realistic, documented path toward a scalable multi-user application.

### 1.3 Honesty principle

AERIS is a **simulation**. Every reading in the initial version is generated in the browser. The UI must label this
clearly and permanently (e.g. a persistent `SIMULATED DATA` badge). AERIS is **not** a certified building management
system, and it is **not** a fire or life-safety system. It must never be connected to real equipment without
explicit developer approval (see §6.9 and §14.6).

### 1.4 Naming note

The repository is named **`Airsy`**; the product is named **AERIS**. Use "AERIS" in the UI, documentation, and code
identifiers (e.g. `useAerisStore`). The repository name does not need to change.

---

## 2. Goals and Non-Goals

### 2.1 Goals (initial prototype)

| ID | Goal |
|----|------|
| G1 | A visually impressive, understandable 3D digital twin of a ~12-floor building as the centerpiece of the UI. |
| G2 | Live (simulated) readings for temperature, CO₂, relative humidity, PM2.5, and VOC, updated continuously. |
| G3 | Centralized, configurable thresholds that classify every reading as normal / warning / critical / offline / invalid. |
| G4 | A deterministic rule-based ventilation control engine, separate from the UI, with priorities and hysteresis. |
| G5 | Every automatic action is explained and recorded in an inspectable event history. |
| G6 | Eight reproducible demonstration scenarios that can be triggered manually during a live presentation. |
| G7 | A professional "building operations console" UI with a consistent design system. |
| G8 | Clean module boundaries that allow a future backend/IoT data source to replace the local simulation. |
| G9 | Automated tests for the domain logic (classification, control, scenarios, events) and key UI interactions. |

### 2.2 Non-goals (initial prototype)

These are **explicitly out of scope** for Phases 1–7 unless the developer approves a scope change:

- ❌ A backend server, database, authentication, or user accounts.
- ❌ Connecting to real sensors, MQTT brokers, BACnet/Modbus devices, or any physical hardware.
- ❌ Machine learning, forecasting, or optimization algorithms for control.
- ❌ Physically accurate HVAC, thermodynamic, or airflow (CFD) simulation. The simulation is a simplified model
  designed to be *plausible and demonstrable*, not engineering-grade.
- ❌ Certified fire, smoke-control, or life-safety functionality of any kind.
- ❌ Dehumidification, heating, or cooling-coil modeling (humidity raises alerts only; see §6.5).
- ❌ Multiple buildings, multiple tenants, or concurrent-user collaboration.
- ❌ Detailed architectural modeling (BIM import, realistic interiors, furniture).
- ❌ Internationalization (UI is English only) and native mobile apps.
- ❌ Claims of production scalability ("thousands of users") — not until a backend and load tests exist.

---

## 3. Users and Key Use Cases

### 3.1 Personas

| Persona | Description | Primary needs |
|---------|-------------|---------------|
| **Facility Operator** | Monitors the building during a shift. | See problems quickly, understand why the system acted, override when necessary. |
| **Building Manager** | Reviews building health and history. | Overall status, trends, alert history. |
| **Presenter / Evaluator** | The developer demonstrating the project, or a lecturer assessing it. | Reliable, reproducible scenarios; visible cause → effect; clear explanations. |
| **Developer / AI assistant** | Maintains and extends the code. | Clear boundaries, typed contracts, tests, this document. |

> In the prototype, all personas use the **same unauthenticated UI**. Role-based access is a future extension (§15.3).

### 3.2 Key use cases

| ID | Use case | Phase |
|----|----------|-------|
| UC-1 | View overall building status at a glance (global status, active alert count, auto/manual mode). | 2 |
| UC-2 | Rotate/zoom the 3D building and select a floor to inspect its readings and devices. | 3 |
| UC-3 | Select an area's sensor marker in 3D to see all readings for that area. | 3 |
| UC-4 | Watch readings change live and see statuses update without reloading. | 4 |
| UC-5 | See the system automatically adjust fans/dampers and read *why* it did so. | 5 |
| UC-6 | Disable automatic mode, or manually override a single device, and later return it to automatic. | 5 |
| UC-7 | Trigger a named demonstration scenario, watch it play out, and reset it. | 6 |
| UC-8 | Review trend charts for the selected floor. | 6 |
| UC-9 | Filter and acknowledge alerts; browse the event history. | 6 |
| UC-10 | Run the educational fire/smoke simulation and end it safely. | 6 |
| UC-11 | Use the dashboard on a tablet or phone with an appropriate fallback for the 3D view. | 3, 7 |

---

## 4. Functional Requirements

Requirements are tagged with the phase in which they are first implemented. **[FUTURE]** marks items that are
*not* part of the initial prototype.

### 4.1 Building & digital twin

- **FR-B1** (P3) Render a configurable multi-floor building (default 12 floors) from configuration data, not hard-coded geometry.
- **FR-B2** (P3) Cutaway / partially transparent façade so internal floors are visible.
- **FR-B3** (P3) Orbit, zoom (bounded), and a sensible default camera framing; a "Reset view" control.
- **FR-B4** (P3) Select a floor from the 3D scene **and** from an accessible floor list; both stay in sync.
- **FR-B5** (P3) Show one sensor marker per area, colored by the area's worst status; selectable.
- **FR-B6** (P3) Show per-floor ventilation equipment with visual states (off/running/speed, damper position).
- **FR-B7** (P3→P5) Visually distinguish normal, warning, critical, offline, and selected states (never by color alone in the 2D UI).
- **FR-B8** (P5) Animate fans and airflow particles proportional to device state; respect reduced motion.
- **FR-B9** (P3) Fallback layout when WebGL is unavailable or the screen is small (2D floor stack; §8.6).

### 4.2 Monitoring

- **FR-M1** (P2) Display current value, unit, timestamp, connection status, and classification for every sensor.
- **FR-M2** (P2) Classification thresholds live in **one configuration module** (§5.5); no numeric thresholds in components.
- **FR-M3** (P2) Each non-normal classification includes a short human-readable explanation.
- **FR-M4** (P4) Readings update continuously from the simulation runtime.
- **FR-M5** (P4) Offline or invalid sensors are never treated as a value of zero; they show "No data" / "Invalid" and the last valid value (greyed, with its time) where helpful.
- **FR-M6** (P2) A persistent "SIMULATED DATA" indicator is always visible.

### 4.3 Control

- **FR-C1** (P5) A rule-based control engine, independent of React, decides fan levels and damper positions.
- **FR-C2** (P5) Rules have explicit priorities; conflicts are resolved deterministically (§6.4).
- **FR-C3** (P5) Hysteresis, debounce, and minimum state-hold time prevent oscillation (§6.6).
- **FR-C4** (P5) No command or event is issued when the target state equals the current state.
- **FR-C5** (P5) Every automatic change records trigger, previous state, new state, timestamp, rule, and reason.
- **FR-C6** (P5) A global automatic-mode toggle; when off, the engine shows *recommendations* but does not apply them.
- **FR-C7** (P5) Per-device manual override with clear return-to-auto rules (§6.7).
- **FR-C8** (P5) A "Why?" inspector shows the latest decision trace for any device.

### 4.4 Alerts & events

- **FR-A1** (P4) Raise, escalate, de-escalate, and resolve alerts from live classifications (with debounce and hysteresis).
- **FR-A2** (P6) Acknowledge alerts; filter alerts by severity, floor, metric, and status.
- **FR-A3** (P2 mock → P4 live) A recent-events timeline; (P6) a full, filterable event history.
- **FR-A4** (P4) Event history is bounded (ring buffer; §11.4).
- **FR-A5** (P4) Screen-reader announcement (polite, throttled) for newly raised critical alerts.

### 4.5 Simulation & scenarios

- **FR-S1** (P4) A single, centralized simulation clock and update loop; play / pause / speed (1×, 2×, 5×, 10×).
- **FR-S2** (P4) Seeded pseudo-random noise so runs are reproducible.
- **FR-S3** (P6) Eight scenarios (§7) that can be started manually, show progress, and can be stopped/reset.
- **FR-S4** (P6) "Reset simulation" returns to the baseline state instantly and deterministically.
- **FR-S5** (P6) Sensor disconnection and invalid-reading injection.

### 4.6 Charts

- **FR-T1** (P6) Live trend charts for the selected floor (one metric at a time, switchable), with threshold bands.
- **FR-T2** (P6) Charts update smoothly without re-rendering the entire dashboard.

### 4.7 Future (not in the prototype)

- **[FUTURE]** Backend API, WebSocket/Socket.IO streaming, PostgreSQL persistence, MQTT ingestion, authentication,
  RBAC, multiple buildings, concurrent users, real hardware integration. See §15.3.

---

## 5. Building and Sensor Specification

### 5.1 Building: "AERIS Tower" (fictional)

A fictional 12-storey mixed-use office tower. All building data lives in configuration
(`src/domain/config/building.ts`), never inside 3D or UI components.

| Floor ID | Level | Name / usage | Area A | Area B | Notes |
|----------|------:|--------------|--------|--------|-------|
| `F01` | 1 | Lobby & Reception | Main Lobby | Café | High foot traffic, large entrance doors. |
| `F02` | 2 | Conference Center | Auditorium | Meeting Suites | High occupancy peaks → CO₂ scenario. |
| `F03`–`F10` | 3–10 | Offices | Open Office North | Open Office South | Typical floors. `F04` used in sensor-fault scenario; `F06` in VOC scenario; `F08` in emergency scenario. |
| `F11` | 11 | Research Labs | Lab Wing | Lab Support | Slightly higher VOC baseline. |
| `F12` | 12 | Sky Lounge | Lounge | Terrace Café | Glass façade, solar gain → temperature scenario. |
| `ROOF` | — | Rooftop plant | — | — | Not a floor. Visual rooftop equipment + outdoor weather station. |

- **Floor count is configurable.** The default is 12. The 3D scene and UI must render any count from 1 to ~20 from config.
- **Two areas per floor** (24 areas) keeps the model simple and readable. Areas are rectangles in floor-local
  coordinates (`bounds`), used for 3D placement and marker positions.
- Each area has an `occupancyCapacity` and a baseline occupancy profile used by the simulation (§5.7).

### 5.2 Identifier conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Building | kebab-case | `aeris-tower` |
| Floor | `F` + 2-digit level | `F07` |
| Area | `{floorId}-{letter}` | `F07-A` |
| Indoor sensor | `{areaId}-{metric}` | `F07-A-co2` |
| Outdoor sensor | `OUT-{metric}` | `OUT-pm25` |
| Device | `{floorId}-{kind code}` | `F07-SF`, `F07-EF`, `F07-OAD` |
| Alert key | `{alertType}:{scope}` | `threshold:co2:F02`, `sensor_offline:F04-A-co2` |

IDs are **stable strings**. Never use array indices as identifiers.

### 5.3 Sensors

- Every indoor **area** has **one sensor per metric** (5 sensors) → 24 areas × 5 = **120 indoor sensors**.
- A **rooftop outdoor station** measures outdoor **temperature, humidity, and PM2.5** (`OUT-temperature`,
  `OUT-humidity`, `OUT-pm25`). Outdoor CO₂ is a configured constant (default **420 ppm**), not a sensor.
- In 3D, the 5 sensors of an area are drawn as **one marker** (a "sensor node") at the area's marker position,
  colored by the worst status among them. Selecting it shows all 5 readings.

Each sensor has (see §10 for exact types):

- Unique `id`, `floorId`, `areaId`, `metric`, `unit`.
- Latest reading: `value` (number or `null`), `timestamp`, `connection` status, `status` classification,
  and `explanation` when not normal.
- `source: 'simulated'` on every reading in the prototype.

### 5.4 Metrics and units

| Metric key | Display name | Unit | Display precision | Plausible range (validity) |
|------------|--------------|------|-------------------|----------------------------|
| `temperature` | Temperature | °C | 1 decimal | −40 to 85 |
| `co2` | Carbon dioxide (CO₂) | ppm | integer | 300 to 10,000 |
| `humidity` | Relative humidity | % RH | integer | 0 to 100 |
| `pm25` | Fine particulate (PM2.5) | µg/m³ | integer | 0 to 1,000 |
| `voc` | VOC Index | index (1–500) | integer | 1 to 500 |

**VOC unit — explicit definition.** AERIS uses a **simulated "VOC Index"** on a scale of **1–500**, where **100
represents the area's typical baseline**. Values above 100 mean more VOCs than usual; below 100, fewer. This is
modeled on the *idea* of relative VOC indices used by some commercial sensors, but it is **not** a ppb or µg/m³
concentration and must be labeled "VOC Index (simulated)" in the UI.

**Validity.** A value outside the plausible range, `NaN`, `Infinity`, or a non-number is an **invalid reading**.
A value of exactly `0` for CO₂ is invalid (below 300). Invalid readings get `status: 'invalid'` and are excluded
from control decisions.

### 5.5 Thresholds (single source: `src/domain/config/thresholds.ts`)

These are **prototype demonstration thresholds** loosely inspired by common indoor-air-quality guidance
(e.g. CO₂ ~1000 ppm as a ventilation-adequacy indicator, WHO 24-hour PM2.5 guideline of 15 µg/m³). They are
**not** regulatory or compliance values.

Each threshold has an **enter** value (status becomes worse when crossed) and an **exit** value (status recovers
only when crossed back). The gap between them is the **hysteresis band** — it stops a reading hovering near a
threshold from flickering between states.

| Metric | Direction | Warning enter | Warning exit | Critical enter | Critical exit |
|--------|-----------|--------------:|-------------:|---------------:|--------------:|
| Temperature (°C) | high | ≥ 26.0 | < 25.5 | ≥ 29.0 | < 28.5 |
| Temperature (°C) | low | ≤ 19.0 | > 19.5 | ≤ 16.0 | > 16.5 |
| CO₂ (ppm) | high | ≥ 1000 | < 950 | ≥ 1500 | < 1400 |
| Humidity (% RH) | high | ≥ 60 | < 57 | ≥ 70 | < 67 |
| Humidity (% RH) | low | ≤ 30 | > 32 | ≤ 20 | > 22 |
| PM2.5 (µg/m³), indoor | high | ≥ 15 | < 12 | ≥ 35 | < 30 |
| VOC Index | high | ≥ 200 | < 180 | ≥ 300 | < 270 |

**Outdoor-air thresholds** (used by control, §6):

| Setting | Value | Meaning |
|---------|------:|---------|
| `outdoorPm25RestrictEnter` | ≥ 35 µg/m³ | Outdoor air is "poor" → restrict outdoor-air intake. |
| `outdoorPm25RestrictExit` | < 25 µg/m³ | Outdoor air acceptable again. |
| `freeCoolingMinDelta` | 2.0 °C | Outdoor air must be at least this much cooler than indoor to help with cooling. |
| `outdoorCo2Ppm` | 420 ppm | Constant outdoor CO₂ concentration. |

**Timing thresholds** (in *simulated* time):

| Setting | Default | Meaning |
|---------|--------:|---------|
| `sensorStaleAfterMs` | 10 000 | No new reading for this long → connection `stale`. |
| `sensorOfflineAfterMs` | 20 000 | No new reading for this long → connection `offline` (also set immediately by fault injection). |
| `alertDebounceSteps` | 3 | A condition must persist for this many consecutive simulation steps before an alert is raised. |

All threshold values must be exported from the config module and imported wherever needed. Tests reference the
config values, not copied literals, except where a test deliberately pins a value.

### 5.6 Classification rules

`classifyReading(metric, value, connection, previousStatus, thresholds)` is a **pure function**
(`src/domain/classification/`). Algorithm:

1. If `connection` is `offline` → status `offline`. If `stale` → keep the previous status but mark the reading as
   stale in the UI. **Stale readings are excluded from control aggregates** (they are display-only), so control never
   acts on old data.
2. If the value is invalid (§5.4) → status `invalid`.
3. Compute the **raw level** using **enter** thresholds: `critical` if a critical-enter threshold is crossed,
   else `warning` if a warning-enter threshold is crossed, else `normal`.
4. If the raw level is **worse than or equal to** `previousStatus` → use the raw level.
5. If the raw level is **better** than `previousStatus` → only improve as far as the **exit** thresholds allow.
   Example (CO₂): previous `critical`, value 1450 → still ≥ 1400 (critical exit) → remains `critical`.
   Value 1350 → below critical exit, but ≥ 950 (warning exit) → becomes `warning`.
6. For two-sided metrics (temperature, humidity), evaluate the high and low sides independently and return the worse.
7. Return `{ status, explanation }`. Explanation example:
   *"CO₂ 1,240 ppm is above the warning threshold (1,000 ppm)."*

**Status ordering** (worst → best) for aggregation: `critical` > `warning` > `invalid` ≈ `offline` > `normal`.
For *display* aggregation, `offline`/`invalid` are shown as a separate "data issue" indicator alongside the worst
*valid* status, so a single offline sensor does not hide a real critical reading.

**Aggregation:**

- **Area status** = worst status of its 5 sensors (with data issues shown separately).
- **Floor metric value** (for control and charts) = **maximum** valid value of that metric across the floor's areas
  (worst-case for CO₂, PM2.5, VOC, high temperature). For low-side temperature/humidity checks, use the minimum.
- **Floor status** = worst area status. **Building status** = worst floor status.

### 5.7 Ventilation devices

Each floor has three controllable simulated devices:

| Code | Kind | Purpose | States |
|------|------|---------|--------|
| `SF` | Supply fan | Delivers air to the floor (mix of outdoor air and filtered recirculated air). | `OFF`, `LOW`, `MEDIUM`, `HIGH`, `BOOST` |
| `EF` | Exhaust fan | Removes stale air from the floor. | `OFF`, `LOW`, `MEDIUM`, `HIGH`, `BOOST` |
| `OAD` | Outdoor-air damper | Controls the fraction of supply air drawn from outside. | `CLOSED`, `MINIMUM`, `PARTIAL`, `OPEN` |

Level → numeric mapping (in `src/domain/config/control.ts`), used by the simulation and the 3D animation:

| Fan level | Airflow factor | | Damper position | Outdoor-air fraction |
|-----------|---------------:|-|-----------------|---------------------:|
| `OFF` | 0.00 | | `CLOSED` | 0.00 |
| `LOW` | 0.25 | | `MINIMUM` | 0.20 |
| `MEDIUM` | 0.50 | | `PARTIAL` | 0.50 |
| `HIGH` | 0.80 | | `OPEN` | 1.00 |
| `BOOST` | 1.00 | | | |

Rooftop equipment in 3D is **visual only** in the prototype (not separately controllable).

### 5.8 Simulation model (simplified, documented)

The simulation is a **simple first-order model**, chosen so that ventilation visibly *works* (closing the loop
between control and readings) while remaining easy to understand and test. It runs per **area** on a **fixed
simulated time step** `dt = 1 s` (§11.1). Constants live in `src/domain/config/simulation.ts` and are tuned in
Phase 4 so scenario effects are visible within ~30–90 s at 1× speed.

For each area, each step:

```
outdoorAirRate   = k_oa  × SF.airflow × OAD.fraction            // fresh-air exchange
exhaustRate      = k_ex  × EF.airflow
filtrationRate   = k_flt × SF.airflow × (1 − OAD.fraction)      // recirculated air through filters
occupants        = occupancyCapacity × occupancyFraction(t)     // from baseline profile or scenario

CO₂   += dt × ( g_co2 × occupants / volume
               − (outdoorAirRate + exhaustRate) × (CO₂ − outdoorCO₂) )
VOC   += dt × ( vocSource(t) − (outdoorAirRate + exhaustRate) × (VOC − vocBaseline) )
PM2.5 += dt × ( outdoorAirRate × (outdoorPM − PM2.5) × (1 − filterEfficiency)
               − filtrationRate × PM2.5 + pmSource(t) )
Temp  += dt × ( heatGain(t) / thermalMass − outdoorAirRate × (Temp − outdoorTemp) − hvacRecovery × (Temp − setpoint) )
RH    += dt × ( moistureSource(t) − outdoorAirRate × (RH − outdoorRH) × c_rh )

value = clamp(stateValue + seededNoise(metric), plausibleRange)
```

- `seededNoise` is small Gaussian-like noise from the seeded PRNG (§11.1), so values look alive but are reproducible.
- Scenario scripts modify **inputs** (occupancy, heat gain, VOC/PM sources, outdoor conditions, sensor faults),
  not the readings directly — except fault injection, which overrides what a sensor *reports*.
- The model is **illustrative**. Do not present it as physically accurate.

---

## 6. Automatic Control Logic

### 6.1 Principles

- **Deterministic and rule-based.** Same inputs → same outputs. No ML.
- **Pure and separate.** The engine lives in `src/domain/control/`, has **no React or store imports**, and is
  fully unit-testable.
- **Explainable.** Every decision produces a trace: which rules fired, which constraints applied, which rule won, and why.
- **Conservative.** Missing data never looks like good data. When in doubt, ventilate moderately and alert.

### 6.2 Evaluation cycle (once per simulation step, per floor)

```
inputs  = floor aggregates (valid readings only) + outdoor conditions + current device states
          + control state (auto mode, manual overrides, emergency) + simulated time
1. Each rule evaluates inputs → zero or more ControlRequests (device, target state, priority, reason)
2. Resolve requests per device (§6.4) → candidate target
3. Apply constraints (e.g. outdoor-air restriction) → constrained target + constraint notes
4. Apply stability gates (hysteresis/dwell, §6.6) → final target or "hold"
5. If final target ≠ current state AND device is in auto AND auto mode enabled → emit DeviceCommand
   If auto mode disabled → store as Recommendation (shown in UI, not applied, not logged per step)
6. Store ControlDecision trace for the "Why?" inspector
```

All device state changes — automatic, manual, or emergency — go through **one function**
(`applyDeviceCommand`), which also writes the `SystemEvent`. This guarantees nothing changes silently.

### 6.3 Rules and priorities

Higher number = higher priority.

| Priority | Rule ID | Trigger | Requested action (per affected floor) |
|---------:|---------|---------|----------------------------------------|
| 1000 | `R-EMERGENCY` | Emergency simulation active (§6.9). | Emergency strategy for every floor; overrides everything, including manual. |
| 900 | `R-MANUAL` | Device has an active manual override. | Hold the manual state (the engine does not command this device). |
| 700 | `R-SENSOR-FALLBACK` | No valid CO₂ data for the floor (all CO₂ sensors offline/invalid). | `SF ≥ MEDIUM`, `OAD ≥ MINIMUM`, `EF ≥ LOW`; raise `control_degraded` alert. |
| 600 | `R-IAQ-CRITICAL` | Floor CO₂, VOC, or indoor PM2.5 is `critical`. | CO₂/VOC: `SF BOOST`, `EF HIGH`, `OAD OPEN`. PM2.5: see §6.5. |
| 500 | `R-IAQ-WARNING` | Floor CO₂, VOC, or indoor PM2.5 is `warning`. | CO₂/VOC: `SF HIGH`, `EF MEDIUM`, `OAD PARTIAL`. PM2.5: see §6.5. |
| 400 | `R-THERMAL` | Floor temperature high-side `warning` / `critical`. | Warning: `SF HIGH`; critical: `SF BOOST`. `OAD OPEN` only if free cooling is available (§6.5), else `OAD MINIMUM`. |
| 100 | `R-BASELINE` | Always. | `SF LOW`, `EF LOW`, `OAD MINIMUM`. |

`R-BASELINE` always issues a request for **every** device, so every device always has at least one candidate.
Rules only request the devices they care about (e.g. `R-THERMAL` does not touch `EF`); other devices fall
through to lower-priority requests. `R-MANUAL` is a **gate**, not a request generator: it removes the device from
automatic resolution (§6.4 step 1) and is listed here only to make its precedence explicit.

**Constraint (applied after resolution, not a competing rule):**

| Constraint ID | Condition | Effect |
|---------------|-----------|--------|
| `C-OUTDOOR-AIR` | Outdoor PM2.5 restricted (enter ≥ 35, exit < 25 µg/m³). | Clamp every `OAD` to at most `MINIMUM`; raise one building-level `outdoor_air_restricted` alert; the reason text names the constraint. Does **not** apply to `R-EMERGENCY`. |

`MINIMUM` (not `CLOSED`) is used because occupied buildings still need some fresh air; this is a deliberate,
documented simplification.

### 6.4 Conflict resolution

For each device:

1. Discard requests for devices under manual override (unless `R-EMERGENCY` is active).
2. Take the requests with the **highest priority**.
3. If several requests share that priority, choose the one asking for **more ventilation** (higher fan level /
   more open damper) — the safer direction for air quality. Ties beyond that break by rule ID order (deterministic).
4. Apply constraints (§6.3). If a constraint changed the target, the decision records both the requested and the
   constrained state.

**Worked example — high CO₂ during poor outdoor air (Scenario 5 + 3 combined):**
`R-IAQ-WARNING` requests `OAD PARTIAL`; `C-OUTDOOR-AIR` clamps it to `MINIMUM`. `SF HIGH` and `EF MEDIUM` still
apply. Reason: *"CO₂ on Floor 2 is 1,180 ppm (warning ≥ 1,000). Increased Supply Fan F02 LOW → HIGH. Outdoor-air
damper limited to MINIMUM because outdoor PM2.5 is 52 µg/m³ (restriction ≥ 35)."*

### 6.5 Metric-specific behavior

- **CO₂** — Fresh air is the remedy: more supply + more outdoor air (subject to `C-OUTDOOR-AIR`).
- **VOC** (e.g. after cleaning) — Same response as CO₂; the alert explanation mentions likely source when the
  scenario provides one ("possible cleaning products").
- **Indoor PM2.5:**
  - If outdoor air is **acceptable**: treat like CO₂ (open damper, dilute).
  - If outdoor air is **restricted**: keep `OAD MINIMUM` and raise `SF` (HIGH for warning, BOOST for critical) to
    increase *filtration* of recirculated air.
- **High temperature** — Raise supply airflow. Open the damper fully **only** for free cooling: outdoor temperature
  ≤ floor temperature − `freeCoolingMinDelta` **and** outdoor air not restricted. Otherwise `OAD MINIMUM`
  (bringing in hot outside air would make things worse). Cooling coils are not modeled.
- **Low temperature** — Alert only; heating is not modeled. Engine keeps baseline.
- **Humidity** — Alerts only in the prototype (no dehumidification model). Documented non-goal.
- **Missing data** — A rule only evaluates a metric if the floor has at least one valid reading for it. If none,
  the rule produces no request for that metric; `R-SENSOR-FALLBACK` covers missing CO₂ (the primary ventilation
  indicator). Last-known values are **never** used for control after `sensorStaleAfterMs`.

### 6.6 Stability safeguards

| Safeguard | Default | Behavior |
|-----------|--------:|----------|
| Threshold hysteresis | §5.5 table | Statuses recover only past the exit threshold. |
| Alert/condition debounce | 3 steps | A new non-normal condition must persist for 3 consecutive steps before rules act on it and an alert is raised. |
| Minimum state hold (`minStateHoldMs`) | 30 000 sim-ms | After a device changes, it will not **decrease** ventilation until this time has elapsed. |
| Escalation bypass | — | **Increases** in ventilation for `critical` conditions may bypass the hold (respond fast to danger, recover slowly). |
| Idempotence | — | If the final target equals the current state → no command, no event. |
| Step-down pacing | 1 level per hold period | When recovering, fans step down one level at a time (e.g. BOOST → HIGH → MEDIUM → LOW), each step respecting the hold time. This makes recovery visible and avoids abrupt swings. |

### 6.7 Automatic vs. manual mode

- **Global auto mode** (default **ON**):
  - ON → engine applies decisions to all devices not under manual override.
  - OFF → engine still evaluates and displays **recommended** actions ("Auto would set SF to HIGH"), but changes
    nothing. Alerts continue normally. Toggling logs `AUTO_MODE_DISABLED` / `AUTO_MODE_ENABLED`.
  - When re-enabled, the next step evaluates normally (subject to safeguards).
- **Per-device manual override:**
  - The operator sets a device to a specific state. The device shows a **MANUAL** badge.
  - The override expires after `manualOverrideTimeoutMs` (default **10 simulated minutes**), or immediately when the
    operator clicks **Return to auto**. Expiry logs `MANUAL_OVERRIDE_EXPIRED`; explicit return logs `MANUAL_OVERRIDE_CLEARED`.
  - Manual changes log `MANUAL_OVERRIDE_SET` with previous and new state.
  - An emergency simulation **suspends** manual overrides; ending the emergency **clears** them (logged), so the
    building returns to a known automatic state.
  - "Reset simulation" clears all overrides.

### 6.8 Decision trace (for the "Why?" inspector)

Each evaluated device stores its latest `ControlDecision` (§10): candidate requests, winning rule, constraints
applied, safeguard outcome (`applied` / `held_by_dwell` / `unchanged` / `manual` / `recommendation_only`), and
the human-readable reason. Only the latest decision per device is kept in live state; meaningful changes are also
in the event history.

### 6.9 Emergency (fire/smoke) simulation — educational only

> ⚠️ **Safety disclaimer.** Real smoke-control strategies depend on the specific building, fire compartmentation,
> and an engineered, code-compliant life-safety design. Opening every damper or running every fan can make a fire
> *worse*. AERIS models **one illustrative strategy** for teaching purposes only. It is **not** a certified fire
> safety system and must **never** be used to control real life-safety equipment.

- The emergency is started **only** by the explicit "Fire/smoke emergency (simulated)" scenario, representing a
  **simulated fire-alarm signal**. AERIS does **not** infer a fire from PM2.5 or temperature readings — real
  buildings rely on certified fire alarm systems for that.
- **Illustrative "pressure sandwich" strategy** (fire floor = `F08` in the scenario):

  | Floor(s) | SF | EF | OAD | Intent (illustrative) |
  |----------|----|----|-----|-----------------------|
  | Fire floor | `OFF` | `BOOST` | `CLOSED` | Exhaust smoke, don't feed air to the fire. |
  | Floors directly above/below | `HIGH` | `OFF` | `OPEN` | Pressurize neighbors to resist smoke entry. |
  | All other floors | `OFF` | `OFF` | `CLOSED` | Shut down to limit smoke spread through ducts. |

- While active: a full-width **red emergency banner** with the disclaimer, normal IAQ rules are suspended,
  manual controls are disabled with an explanation, and each device change is logged with rule `R-EMERGENCY`.
- **Ending:** only via an explicit "End emergency simulation" action (or "Reset simulation"). Ending logs
  `EMERGENCY_ENDED`, clears manual overrides, and hands control back to normal rules.

---

## 7. Demonstration Scenarios

### 7.1 General scenario mechanics

- Scenarios are **data**: a scripted list of timed steps (`ScenarioStep`, §10) in `src/domain/scenarios/definitions/`.
- **Starting** any scenario except *Recovery* first performs a **soft reset to baseline** (same seed, cleared
  alerts, devices at baseline, overrides cleared) so the scenario always starts from the same conditions.
  The event log is **kept** and receives `SCENARIO_STARTED`.
- **Recovery** (scenario 8) starts from the *current* state, because it is meant to follow another scenario.
- Only **one scenario** runs at a time. Starting another asks for confirmation, then starts it (with its own soft reset).
- Step times are in **simulated time** from scenario start; at 1× speed, simulated time ≈ real time.
- **Stop scenario** halts further steps but leaves conditions as they are. **Reset simulation** (hard reset)
  restores baseline, clears alerts, overrides, history, and the event log, then logs a single `SIMULATION_RESET`.
- All scenarios use the fixed default seed (`simulationConfig.defaultSeed`) so a rehearsed demo behaves the same live.
- Expected timings below are **targets** to tune in Phase 4–6; tests assert *ordering and outcomes*, not exact seconds.

### 7.2 Scenario specifications

#### S1 — Normal building operation (`normal-operation`)

| Aspect | Specification |
|--------|---------------|
| Purpose | Show a healthy building and baseline live data. Also the reference state for resets. |
| Initial conditions | All sensors online; occupancy at baseline weekday profile (~50–70%); outdoor 18 °C, 55% RH, PM2.5 8 µg/m³. |
| Readings | Temp 21–24 °C, CO₂ 500–800 ppm, RH 40–50%, PM2.5 3–8, VOC 80–120. Gentle noise only. |
| Expected alerts | None. |
| Expected devices | All floors: `SF LOW`, `EF LOW`, `OAD MINIMUM`. |
| Expected events | `SCENARIO_STARTED (normal-operation)`. No device events after the initial state. |
| Reset | Is the baseline; "Reset simulation" returns here. |

#### S2 — Elevated temperature (`elevated-temperature`) — Floor 12

| Aspect | Specification |
|--------|---------------|
| Initial conditions | Baseline; outdoor 16 °C (free cooling available). |
| Steps | t+0 s: F12 solar `heatGain` ramps up over 40 s. t+60 s: heat gain increases further (afternoon sun). |
| Readings | F12 temperature rises to ~26.5 °C (warning) by ~t+30–45 s, then ~29.5 °C (critical) by ~t+70–90 s. Other floors unchanged. |
| Expected alerts | `threshold:temperature:F12` raised as **warning**, escalated to **critical**. |
| Expected devices | F12 `SF LOW → HIGH` (warning) → `BOOST` (critical); `OAD MINIMUM → OPEN` (free cooling, outdoor cooler by ≥ 2 °C). |
| Expected events | `SCENARIO_STARTED`, `ALERT_RAISED (warning)`, `DEVICE_STATE_CHANGED` ×2 (rule `R-THERMAL`, reason mentions free cooling), `ALERT_ESCALATED (critical)`, `DEVICE_STATE_CHANGED (SF → BOOST)`, `SCENARIO_COMPLETED`. |
| Reset | Run S8 Recovery (heat gain returns to baseline) or Reset simulation. |

#### S3 — High CO₂ (`high-co2`) — Floor 2

| Aspect | Specification |
|--------|---------------|
| Initial conditions | Baseline. |
| Steps | t+0 s: F02 Auditorium occupancy → 100% (conference begins). t+30 s: Meeting Suites occupancy → 95%. |
| Readings | F02 CO₂ climbs past 1000 ppm (~t+20–40 s) then toward ~1500+ ppm if ventilation were insufficient. With control active, CO₂ stabilizes/falls back toward ~900–1100 ppm. |
| Expected alerts | `threshold:co2:F02` **warning**; may briefly reach **critical** before ventilation catches up (acceptable; tune so it is visible). |
| Expected devices | F02 `SF LOW → HIGH` (or `BOOST` if critical), `EF LOW → MEDIUM/HIGH`, `OAD MINIMUM → PARTIAL/OPEN`. |
| Expected events | `SCENARIO_STARTED`, `SCENARIO_STEP`, `ALERT_RAISED`, `DEVICE_STATE_CHANGED` ×3 (rule `R-IAQ-WARNING`), possibly escalation events. |
| Demonstrates | Closed loop: ventilation visibly reduces CO₂; hysteresis prevents flicker near 1000 ppm. |
| Reset | S8 Recovery (occupancy returns to baseline) or Reset simulation. |

#### S4 — VOC spike after cleaning (`voc-cleaning`) — Floor 6

| Aspect | Specification |
|--------|---------------|
| Initial conditions | Baseline, evening (low occupancy, 10%). |
| Steps | t+0 s: F06-A `vocSource` pulse (cleaning crew, 60 s). t+20 s: F06-B pulse (40 s). |
| Readings | F06-A VOC Index → ~320 (critical), F06-B → ~230 (warning); decays as sources stop and ventilation increases. |
| Expected alerts | `threshold:voc:F06` **critical**, explanation: *"VOC Index elevated — possible cleaning products (simulated)."* Later de-escalates and resolves. |
| Expected devices | F06 `SF → BOOST`, `EF → HIGH`, `OAD → OPEN`; then step-down one level per hold period as VOC falls. |
| Expected events | `SCENARIO_STARTED`, `ALERT_RAISED (critical)`, `DEVICE_STATE_CHANGED` ×3 (`R-IAQ-CRITICAL`), `ALERT_DEESCALATED`, `DEVICE_STATE_CHANGED` (step-downs), `ALERT_RESOLVED`, `SCENARIO_COMPLETED`. |
| Reset | Self-recovers; or S8 / Reset simulation. |

#### S5 — Poor outdoor air quality (`poor-outdoor-air`) — whole building

| Aspect | Specification |
|--------|---------------|
| Initial conditions | Baseline. |
| Steps | t+0 s: outdoor PM2.5 ramps 8 → 55 µg/m³ over 30 s (e.g. regional wildfire smoke — fictional). t+40 s: F02 occupancy rises (to combine with CO₂). |
| Readings | `OUT-pm25` crosses 35 (~t+20 s). Indoor PM2.5 rises slightly before the damper restricts, then is held low by filtration. F02 CO₂ rises moderately. |
| Expected alerts | `outdoor_air_restricted` (building, **warning**). Possibly `threshold:co2:F02` **warning**. |
| Expected devices | All `OAD → MINIMUM` (those already at MINIMUM unchanged → no event). F02 `SF → HIGH`, `EF → MEDIUM`, `OAD` held at `MINIMUM` with constraint explanation. |
| Expected events | `CONTROL_CONSTRAINT_ACTIVE (C-OUTDOOR-AIR)`, `ALERT_RAISED (outdoor_air_restricted)`, `DEVICE_STATE_CHANGED` entries whose reasons cite the constraint. |
| Demonstrates | Conflict resolution between "more fresh air" and "outside air is bad". |
| Reset | S8 Recovery (outdoor PM returns to 8; constraint clears below 25) or Reset simulation. |

#### S6 — Fire/smoke emergency simulation (`fire-emergency`) — Floor 8 (educational)

| Aspect | Specification |
|--------|---------------|
| Initial conditions | Baseline. Disclaimer shown in a confirmation dialog **before** starting. |
| Steps | t+0 s: simulated fire-alarm signal for F08 → emergency mode starts. t+0–30 s: F08 PM2.5 (smoke proxy) and temperature rise sharply. |
| Readings | F08 PM2.5 → 150+ µg/m³ (critical), temperature +5–8 °C. Neighbor floors rise slightly. |
| Expected alerts | `emergency` alert (**critical**, building-level, cannot be acknowledged away while active); `threshold:pm25:F08` critical. |
| Expected devices | Per §6.9 table (F08 exhaust, F07/F09 pressurize, others shut down). |
| Expected events | `SCENARIO_STARTED`, `EMERGENCY_STARTED`, ~36 `DEVICE_STATE_CHANGED` (rule `R-EMERGENCY`; may be grouped in the UI as one expandable entry), `ALERT_RAISED`. |
| UI | Red emergency banner + disclaimer; manual controls disabled; 3D highlights fire floor and pressurized neighbors; airflow particles show exhaust direction. |
| Reset | **Explicit** "End emergency simulation" → `EMERGENCY_ENDED`, overrides cleared, auto rules resume; then S8 Recovery for readings. Or Reset simulation. |

#### S7 — Sensor disconnection (`sensor-disconnection`) — Floor 4

| Aspect | Specification |
|--------|---------------|
| Initial conditions | Baseline; F04 occupancy slightly elevated (75%). |
| Steps | t+5 s: `F04-A-co2` disconnects. t+20 s: `F04-B-co2` disconnects (no valid CO₂ on F04). t+35 s: `F04-A-humidity` starts reporting an implausible 140% (invalid). |
| Readings | Disconnected sensors show **"No data"** with last-known value greyed and timestamped; never 0. Invalid sensor shows **"Invalid reading"**. |
| Expected alerts | `sensor_offline:F04-A-co2`, `sensor_offline:F04-B-co2` (warning); `control_degraded:F04` (warning); `sensor_invalid:F04-A-humidity` (warning). |
| Expected devices | After the first disconnect: no change (F04-B-co2 still valid). After the second: `R-SENSOR-FALLBACK` → `SF MEDIUM`, `OAD MINIMUM`, `EF LOW`. |
| Expected events | `SENSOR_DISCONNECTED` ×2, `CONTROL_FALLBACK_ACTIVE`, `DEVICE_STATE_CHANGED (SF LOW → MEDIUM, R-SENSOR-FALLBACK)`, `SENSOR_INVALID_READING`. |
| Demonstrates | Missing data is not zero; graceful degradation; transparency. |
| Reset | S8 Recovery reconnects all sensors → `SENSOR_RECONNECTED`, `CONTROL_FALLBACK_CLEARED`, alerts resolve. Or Reset simulation. |

#### S8 — Recovery to normal conditions (`recovery`)

| Aspect | Specification |
|--------|---------------|
| Initial conditions | **Current state** (typically after S2–S7). If an emergency is active, the user must end it first (Recovery is disabled with an explanation). |
| Steps | t+0 s: all scenario inputs (heat gain, occupancy, VOC/PM sources, outdoor conditions) ramp back to baseline over 30 s; all faulted sensors reconnect and report valid values. |
| Readings | Return toward baseline ranges within ~60–120 s at 1×. |
| Expected alerts | All scenario alerts de-escalate and **resolve** — only after crossing exit thresholds (hysteresis visible). |
| Expected devices | Step down one level per hold period to baseline (`SF LOW`, `EF LOW`, `OAD MINIMUM`). |
| Expected events | `SCENARIO_STARTED (recovery)`, `SENSOR_RECONNECTED` (if any), `ALERT_DEESCALATED`/`ALERT_RESOLVED`, `DEVICE_STATE_CHANGED` (step-downs, rule `R-BASELINE` or lower-tier rules), `CONTROL_CONSTRAINT_CLEARED` (if any), `SCENARIO_COMPLETED` when all floors are normal and devices at baseline. |
| Reset | Ends in the S1 state (readings differ only by noise). |

### 7.3 Suggested live demo script (~8 minutes)

1. Start in S1; orbit the building; select F12 and F02 to show floor details. (1 min)
2. Run S3 (High CO₂) at 2×; open the "Why?" inspector on F02's supply fan. (1.5 min)
3. Run S5 (Poor outdoor air) to show conflict resolution and the constraint explanation. (1.5 min)
4. Run S7 (Sensor disconnection) to show "No data ≠ 0" and fallback. (1.5 min)
5. Run S6 (Emergency) — read the disclaimer aloud; end the emergency. (1.5 min)
6. Run S8 (Recovery) at 5×; show alerts resolving and the event history. (1 min)

---

## 8. UX and Visual Design System

### 8.1 Design intent

A **premium, calm, dark building-operations console**. The **3D digital twin is the visual centerpiece**; panels
around it are dense, legible, and quiet until something needs attention. Color is reserved for **meaning**
(status, interaction, live data), not decoration. It must not look like a generic template of endless cards.

### 8.2 Layout and hierarchy

**Desktop (≥ 1280 px)** — primary target (presentation laptop):

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ AERIS · AERIS Tower   ● Building: WARNING   2 active alerts   AUTO ◉   ▶ 1× ▾   SIMULATED │  Top status bar
├──────────────────────────────────────────────────────────┬────────────────────────────────┤
│ ┌─────┐                                                  │ FLOOR 07 · Offices      ▲ ▼    │
│ │ F12 │                                                  │ Status: Normal · 2 areas       │
│ │ F11 │            3D DIGITAL TWIN (primary)             │ Temp 23.1°C  CO₂ 742  RH 45%   │  Selected floor
│ │ ... │     orbit · zoom · click floor / sensor          │ PM2.5 6      VOC 104           │  (metrics + areas)
│ │ F01 │                                                  │ ─ Devices ───────────────────  │
│ └─────┘  floor rail (keyboard accessible)    [Reset view]│ Supply fan  LOW   AUTO  [Why?] │  Devices
│                                                          │ Exhaust fan LOW   AUTO  [Why?] │
│                                                          │ OA damper   MIN   AUTO  [Why?] │
│                                                          ├────────────────────────────────┤
│                                                          │ ACTIVE ALERTS (2)    filter ▾  │  Alerts
│                                                          │ ▲ CO₂ warning · F02 · 1,180ppm │
├──────────────────────────────────────────────────────────┴────────────────────────────────┤
│ TRENDS (F07 · CO₂ ▾)  ~~~~~~~~~~~~~~~~~~~~      │ EVENTS  12:04:31 SF F02 LOW→HIGH …     │  Bottom band
│                                                  │ SCENARIOS  [S1][S2]…[S8]  Reset sim    │  (tabs if tight)
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Hierarchy (most → least prominent): global status → 3D twin → selected floor → devices & control mode →
active alerts → trends → events → scenario controls.

**Tablet (768–1279 px):** 3D view on top (≈ 55vh), panels stacked below in a two-column grid; bottom band becomes tabs.

**Phone (< 768 px):** Tabbed layout (Building · Alerts · Events · Scenarios). The Building tab shows the **2D floor
stack** fallback by default with a "Load 3D view" button (§8.6). No horizontal scrolling.

### 8.3 Color tokens

Defined as CSS custom properties in `src/styles/tokens.css` (single source) and mapped into the Tailwind theme.
3D code reads the same variables at scene mount via a small helper (`readCssToken('--color-status-warning')`)
so the 3D scene and the UI never drift apart.

| Token | Value | Use |
|-------|-------|-----|
| `--color-bg` | `#0D0F13` | App background (charcoal). |
| `--color-surface-1` | `#14171D` | Panels. |
| `--color-surface-2` | `#1B1F27` | Elevated elements, hover rows, popovers. |
| `--color-surface-3` | `#232834` | Inputs, pressed states. |
| `--color-border` | `#2A303C` | Hairline borders and dividers. |
| `--color-border-strong` | `#3A4250` | Focused/selected panel borders. |
| `--color-text-primary` | `#F2F4F7` | Primary text and key values. |
| `--color-text-secondary` | `#A7B0BE` | Labels, secondary text. |
| `--color-text-muted` | `#7C8594` | Tertiary text, units, timestamps (verify ≥ 4.5:1 where used for essential text). |
| `--color-accent` | `#22D3EE` | Primary interactions, live data, selection (cyan). |
| `--color-accent-strong` | `#67E8F9` | Hover/active accent. |
| `--color-accent-subtle` | `rgba(34,211,238,0.12)` | Selected backgrounds, focus glow. |
| `--color-status-normal` | `#34D399` | Normal (green). |
| `--color-status-warning` | `#FBBF24` | Warning (amber). |
| `--color-status-critical` | `#F87171` | Critical (red; `#EF4444` for fills/large areas). |
| `--color-status-offline` | `#6B7280` | Offline / invalid (grey, with dashed/hatched treatment). |
| `--color-emergency` | `#DC2626` | Emergency banner only. |
| `--color-focus-ring` | `#67E8F9` | Keyboard focus outline (2px, offset 2px). |

**Rules:**
- Status is **never communicated by color alone** in 2D UI: always pair with an icon (Lucide) and/or text label
  (e.g. ▲ triangle for warning, ⬣ octagon for critical, ⊘ slashed circle for offline).
- Body text must meet **WCAG AA (4.5:1)** against its background; large text and UI components ≥ 3:1. Verify in Phase 2/7.
- Selected state uses the **accent** (cyan outline/glow), distinct from all status colors.

### 8.4 Typography, spacing, shape, elevation

| Category | Tokens |
|----------|--------|
| Font (UI) | `Inter`, falling back to the system UI stack. Self-host only if a dependency is approved; system stack is acceptable. |
| Font (data) | Same family with `font-variant-numeric: tabular-nums`; optional monospace (`JetBrains Mono`/system mono) for IDs and timestamps. |
| Type scale | 11 (micro labels, uppercase, +0.06em tracking) · 12 · 13 · 14 (base) · 16 · 20 · 24 · 32 (hero metric). |
| Weights | 400 regular, 500 medium (labels), 600 semibold (headings/values). |
| Spacing | 4 px base: 4, 8, 12, 16, 20, 24, 32, 48. |
| Radii | `--radius-sm` 4px (badges), `--radius-md` 8px (controls), `--radius-lg` 12px (panels). |
| Borders | 1px `--color-border`; panels separated by borders and spacing more than by shadows. |
| Elevation | `--shadow-1: 0 1px 2px rgba(0,0,0,.4)`; `--shadow-2: 0 8px 24px rgba(0,0,0,.45)` (popovers/dialogs only). |

### 8.5 Motion

| Token | Value | Use |
|-------|-------|-----|
| `--motion-fast` | 120 ms | Hover, press, badge color change. |
| `--motion-base` | 200 ms | Panel content transitions, status transitions. |
| `--motion-slow` | 320 ms | Drawer/dialog enter, chart line updates. |
| Camera move | 600–900 ms, damped | Floor selection focus in 3D. |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default easing. |

Purposeful animations: smooth floor selection (camera + floor lift/highlight), sensor status color transitions,
a subtle "live" pulse on the LIVE indicator (≤ 1 pulse/2 s), device state transitions (fan spin speed ramps
smoothly), airflow particles, panel transitions, chart updates.

**Reduced motion (`prefers-reduced-motion: reduce`):** camera jumps instantly, particles are hidden or static
arrows, fans show state without spinning, pulses disabled, transitions ≤ 1 frame or simple fades. A user toggle in
the UI may also force reduced motion. Never flash content more than 3 times per second.

### 8.6 3D scene visual specification

- **Building:** stacked floor slabs (thin boxes) with a core (elevator/stair shaft), glass façade as a
  semi-transparent material with edge lines; a **cutaway** (e.g. front-right quadrant of the façade removed or
  highly transparent) so floor interiors and markers are visible. Area footprints drawn as subtle tinted planes.
- **Floor states:** unselected floors are dimmed; the **selected floor** lifts slightly (or neighbors fade) with an
  accent outline; floors with active alerts get a status-colored edge glow.
- **Sensor nodes:** small glowing spheres/pills per area, colored by status; offline nodes are grey and hollow/dashed;
  selected node gets an accent ring and a floating label (Drei `Html`) with key readings.
- **Devices:** simple stylized fan housings (spinning blades), exhaust grilles, and damper louvers (rotating slats)
  near the core/façade per floor; rooftop plant boxes.
- **Airflow:** instanced particles flowing from supply to exhaust paths; density/speed proportional to fan airflow;
  direction reverses visually for exhaust; tinted red/grey during the emergency for the fire floor.
- **Lighting:** cool ambient + one directional key light; no expensive real-time shadows by default.
- **Environment:** dark ground plane with a faint grid; optional subtle fog for depth.
- **Fallback (no WebGL, WebGL context loss, or phone):** a **2D floor stack** — a vertical list of floor bars
  showing each floor's status, key metrics, and device states, fully interactive (select floor). This is also the
  keyboard/screen-reader-accessible equivalent of the 3D scene.

### 8.7 Components and states

Every data-driven component must handle the relevant states:

| State | Behavior |
|-------|----------|
| Loading | Skeleton shimmer (static under reduced motion) while the 3D chunk loads or before the first snapshot. |
| Empty | Clear message, e.g. "No active alerts — all floors normal." |
| Offline/invalid data | "No data" / "Invalid reading" with last-known value greyed + time; offline icon. |
| Error | Error boundary around the 3D scene and each major panel with a plain message and a retry/fallback. |
| Alert | Status color + icon + label; critical alerts also surface in the top bar. |
| Emergency | Full-width red banner with disclaimer; disabled manual controls explain why. |
| Paused simulation | Clear "PAUSED" indicator; live pulse stops. |

**Every control must do something real.** No decorative buttons. If a feature is not implemented yet in the current
phase, the control is **absent**, not disabled-forever.

### 8.8 Accessibility checklist

- [ ] All interactive elements reachable and operable by keyboard; visible focus ring.
- [ ] Floor rail: ↑/↓ moves selection; Enter/Space selects; Home/End jump.
- [ ] The 3D canvas has an accessible label and is never the *only* way to reach information (floor rail + 2D panels).
- [ ] `aria-live="polite"` region announces newly raised critical alerts (throttled to avoid spam).
- [ ] Status conveyed by icon/text, not color alone.
- [ ] Contrast meets WCAG AA.
- [ ] Reduced-motion preference respected (§8.5).
- [ ] Dialogs (scenario confirm, emergency disclaimer) trap focus and close with Escape.

---

## 9. Technical Architecture

### 9.1 Recommended stack

| Concern | Choice | Why (plain English) |
|---------|--------|---------------------|
| UI library | **React** | Component model; required ecosystem for React Three Fiber. |
| Language | **TypeScript (`strict: true`)** | Shared, checked contracts between simulation, control, 3D, and UI. Catches mistakes early. |
| Build tool | **Vite** | Fast dev server, simple config, first-class React + TS support. |
| Styling | **Tailwind CSS** + CSS custom properties | Tokens live in CSS variables (one source, also readable from 3D); Tailwind gives consistent spacing/typography utilities without writing lots of custom CSS. |
| 3D | **Three.js + React Three Fiber + Drei** | R3F lets the 3D scene be built from React components; Drei provides camera controls, `Html` labels, and helpers. |
| State | **Zustand** | Tiny, no boilerplate, supports selectors (components re-render only for the data they use) and non-React reads (`getState()`) for the 3D render loop. |
| Charts | **Recharts** | Declarative React charts, enough for line charts with threshold bands. |
| Icons | **lucide-react** | Consistent, tree-shakable icon set. |
| UI animation | **CSS transitions first**; add `motion` (Framer Motion) **only if** enter/exit animations become awkward in CSS. | Avoid a dependency until it earns its place. |
| 3D animation | R3F `useFrame` + damping helpers (e.g. `maath/easing`, a Drei dependency) | No extra animation library inside the scene. |
| Testing | **Vitest + React Testing Library + jsdom** | Same config as Vite; fast unit tests for pure domain logic and component tests. |
| Lint/format | **ESLint + Prettier** | Consistency; ESLint `no-restricted-imports` enforces module boundaries (§9.3). |
| Package manager | **npm** | Default; simplest for a solo student project. |

**Version policy.** At Phase 1, use the **current stable major versions** and **verify peer-dependency
compatibility before installing** — in particular, React Three Fiber's major version is tied to React's major
version (e.g. R3F v9 ↔ React 19, R3F v8 ↔ React 18), and Drei must match R3F. Record exact chosen versions in
Appendix B. Do not add a dependency merely because it is popular; each new dependency needs a one-line
justification in the phase summary.

**No router initially.** AERIS is a single console page. Add `react-router` only if a second page is approved
(e.g. a full-screen event history), and record the decision.

### 9.2 Layered architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ UI LAYER (React)                                                     │
│  app/ (shell, layout)   features/* (dashboard, building3d, alerts,  │
│  components/ui (primitives)          events, devices, charts, ...)  │
│        reads via selectors ▲                 │ user actions          │
└────────────────────────────┼─────────────────┼───────────────────────┘
                             │                 ▼  runtime.dispatch(cmd)
┌────────────────────────────┴───────────────────────────────────────────┐
│ STATE LAYER  store/  — Zustand stores                                   │
│  liveStore: mirror of the latest LiveSnapshot (written ONLY by adapter) │
│  uiStore:   selection, panel tabs, filters, reduced-motion toggle       │
└────────────────────────────▲─────────────────────────────────────────────┘
                             │ subscribe(snapshot)
┌────────────────────────────┴───────────────────────────────────────────┐
│ RUNTIME BOUNDARY  domain/runtime/  — AerisRuntime interface             │
│  LocalSimulationRuntime (prototype)   RemoteRuntime [FUTURE: WebSocket] │
└────────────────────────────▲─────────────────────────────────────────────┘
                             │ orchestrates each step
┌────────────────────────────┴───────────────────────────────────────────┐
│ DOMAIN LAYER (pure TypeScript — no React, no store, no DOM)             │
│  types/  config/  classification/  simulation/  control/  alerts/       │
│  events/  scenarios/                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why this shape?** The domain layer is plain functions and data, so it is easy to test and could later run on a
server unchanged. The UI never talks to the simulation directly — it talks to the `AerisRuntime` interface. In the
future, a `RemoteRuntime` that receives snapshots over WebSocket can replace `LocalSimulationRuntime` without
changing the UI.

### 9.3 Intended directory structure

(Final details may adjust during implementation; **boundaries** must not.)

```
/
├─ CLAUDE.md                     ← this file
├─ README.md                     ← short intro + how to run (expanded in Phase 7)
├─ index.html
├─ package.json / tsconfig*.json / vite.config.ts / eslint & prettier config
├─ public/
└─ src/
   ├─ main.tsx                   ← bootstraps React, creates the runtime, connects store adapter
   ├─ app/                       ← App shell, responsive layout, error boundaries, providers
   ├─ components/ui/             ← primitives: Panel, StatusBadge, MetricValue, Button, Toggle,
   │                               SegmentedControl, Tooltip, Dialog, Skeleton, EmptyState
   ├─ features/
   │  ├─ status-bar/             ← global status, sim controls, auto-mode toggle, SIMULATED badge
   │  ├─ building3d/             ← Canvas, CameraRig, Building, FloorSlab, SensorNode, FanModel,
   │  │                            DamperModel, Airflow, FloorStackFallback, webgl detection
   │  ├─ floor-details/          ← selected floor metrics, areas, sensor details
   │  ├─ devices/                ← device list, manual override controls, "Why?" inspector
   │  ├─ alerts/                 ← active alerts, filters, acknowledge, alert history
   │  ├─ events/                 ← timeline + full history
   │  ├─ charts/                 ← trend chart(s)
   │  └─ scenarios/              ← scenario list, progress, reset, emergency dialog/banner
   ├─ domain/                    ← PURE TS. Must not import from app/, components/, features/, store/, or React.
   │  ├─ types/                  ← ALL shared types (single authoritative source; §10)
   │  ├─ config/                 ← building.ts, thresholds.ts, control.ts, simulation.ts
   │  ├─ classification/         ← classifyReading, aggregate helpers
   │  ├─ simulation/             ← rng (seeded), clock, environment model, fault injection
   │  ├─ control/                ← rules/, resolve.ts, constraints.ts, safeguards.ts, engine.ts, applyDeviceCommand.ts
   │  ├─ alerts/                 ← alert evaluator (raise/escalate/resolve with debounce)
   │  ├─ events/                 ← event factory + bounded ring buffer
   │  ├─ scenarios/              ← definitions/, scenario engine
   │  ├─ history/                ← bounded trend buffers
   │  └─ runtime/                ← AerisRuntime interface, LocalSimulationRuntime, commands
   ├─ store/                     ← liveStore, uiStore, selectors, runtime→store adapter
   ├─ styles/                    ← tokens.css, globals.css
   └─ test/                      ← setup, fixtures, builders (domain tests may live beside source as *.test.ts)
```

**Boundary rules (enforced by ESLint `no-restricted-imports` from Phase 1):**

1. `domain/**` imports only from `domain/**`. No React, Zustand, Three, DOM APIs, or `Date.now()`
   (time comes from the simulation clock).
2. `features/**` read state via `store/` selectors and send actions via `runtime.dispatch`. Features do not import
   each other's internals; share via `components/ui` or `store/selectors`.
3. `building3d/**` must not contain domain logic (no thresholds, no rules) — it only *visualizes* state.
4. Only the **store adapter** writes to `liveStore`.
5. Shared types are defined **once** in `domain/types/`. Specialists must not redefine them locally.

### 9.4 Runtime contract

```ts
// src/domain/runtime/AerisRuntime.ts
export interface AerisRuntime {
  start(): void;                       // begins (or resumes) the update loop
  stop(): void;                        // stops the loop and clears timers (cleanup)
  getSnapshot(): LiveSnapshot;         // latest immutable snapshot
  subscribe(listener: (snapshot: LiveSnapshot) => void): () => void; // returns unsubscribe
  dispatch(command: AerisCommand): CommandResult;
}

export type AerisCommand =
  | { type: 'simulation/play' }
  | { type: 'simulation/pause' }
  | { type: 'simulation/setSpeed'; speed: SimulationSpeed }
  | { type: 'simulation/reset' }
  | { type: 'scenario/start'; scenarioId: ScenarioId }
  | { type: 'scenario/stop' }
  | { type: 'emergency/end' }
  | { type: 'control/setAutoMode'; enabled: boolean }
  | { type: 'device/setManual'; deviceId: DeviceId; state: DeviceState }
  | { type: 'device/returnToAuto'; deviceId: DeviceId }
  | { type: 'alert/acknowledge'; alertId: AlertId };

export type CommandResult = { ok: true } | { ok: false; reason: string };
```

**Why commands instead of letting components change the store?** All state changes flow through one place, get
validated (e.g. "manual control is disabled during the emergency"), and get logged. Later, the same commands can be
sent to a server — which is exactly how a multi-user system needs to work.

### 9.5 Data flow per simulation step

```
LocalSimulationRuntime.step(dt):
  1. scenarioEngine.advance(t)         → updates environment inputs / fault injections; emits scenario events
  2. simulation.stepEnvironment(dt)    → new internal area states (uses current device states)
  3. simulation.readSensors()          → SensorReading per sensor (applies faults, validity, noise)
  4. classification                    → status + explanation per reading (with hysteresis)
  5. alertEvaluator                    → raise / escalate / de-escalate / resolve alerts; emits events
  6. controlEngine.evaluate()          → ControlDecisions; applyDeviceCommand() for applied ones; emits events
  7. history.push(floor aggregates)    → bounded trend buffers
  8. build next LiveSnapshot (structural sharing: unchanged parts keep the same object references)
publish(snapshot) → store adapter → liveStore.setState(snapshot)  (once per publish, see §11.2)
```

### 9.6 Scalability path (design now, build later)

| Future need | How the prototype prepares for it |
|-------------|-----------------------------------|
| Node.js backend | Domain layer is pure TS with no browser dependencies → can run server-side. |
| WebSockets / Socket.IO | `AerisRuntime` interface: a `RemoteRuntime` receives `LiveSnapshot`s (or deltas) and sends `AerisCommand`s. |
| PostgreSQL | `SystemEvent`, `Alert`, and `SensorReading` are serializable, ID-based records with timestamps — they map to tables. |
| MQTT sensors | Simulation step 3 ("read sensors") is the seam: replace simulated readings with ingested messages normalized to `SensorReading`. |
| Auth / RBAC | Commands are the natural place to check permissions ("operator may override devices; viewer may not"). |
| Multiple buildings | `Building` is an entity with an ID; floors/areas/sensors reference IDs, not array positions. |
| Concurrent users | Server becomes the single authority; clients render snapshots and send commands. |

---

## 10. Data Models

These types live in `src/domain/types/` and are the **single authoritative definition**. Phase 2 implements them;
later phases may extend them only through the Lead Architect (§14.4), recording changes in Appendix B.

```ts
// ---------- Primitive aliases ----------
export type BuildingId = string;   // 'aeris-tower'
export type FloorId = string;      // 'F07'
export type AreaId = string;       // 'F07-A'
export type SensorId = string;     // 'F07-A-co2' | 'OUT-pm25'
export type DeviceId = string;     // 'F07-SF'
export type AlertId = string;
export type EventId = string;
export type ScenarioId =
  | 'normal-operation' | 'elevated-temperature' | 'high-co2' | 'voc-cleaning'
  | 'poor-outdoor-air' | 'fire-emergency' | 'sensor-disconnection' | 'recovery';
export type SimTimeMs = number;    // simulated epoch milliseconds (NOT wall-clock)

export type MetricType = 'temperature' | 'co2' | 'humidity' | 'pm25' | 'voc';
export type MetricUnit = '°C' | 'ppm' | '%RH' | 'µg/m³' | 'index';
export type HealthStatus = 'normal' | 'warning' | 'critical' | 'offline' | 'invalid';
export type ConnectionStatus = 'online' | 'stale' | 'offline';
export type Severity = 'info' | 'warning' | 'critical';

export interface Vec3 { x: number; y: number; z: number }
export interface Rect2D { x: number; z: number; width: number; depth: number } // floor-local, metres

// ---------- Static configuration (from config/, never mutated at runtime) ----------
export interface Building {
  id: BuildingId;
  name: string;                       // 'AERIS Tower'
  floorIds: FloorId[];                // ordered bottom → top
  footprint: { width: number; depth: number };   // metres, for 3D
  floorHeight: number;                // metres
  outdoorSensorIds: SensorId[];
}

export interface Floor {
  id: FloorId;
  buildingId: BuildingId;
  level: number;                      // 1-based
  name: string;                       // 'Offices'
  usage: 'lobby' | 'conference' | 'office' | 'lab' | 'lounge';
  areaIds: AreaId[];
  deviceIds: DeviceId[];
}

export interface Area {
  id: AreaId;
  floorId: FloorId;
  name: string;                       // 'Open Office North'
  bounds: Rect2D;
  markerPosition: Vec3;               // floor-local position of the sensor node
  volumeM3: number;                   // used by the simulation
  occupancyCapacity: number;
  baseline: Record<MetricType, number>; // typical values (VOC baseline ≈ 100)
}

export interface Sensor {
  id: SensorId;
  floorId: FloorId | null;            // null for outdoor sensors
  areaId: AreaId | null;              // null for outdoor sensors
  metric: MetricType;
  unit: MetricUnit;
  location: 'indoor' | 'outdoor';
}

// ---------- Live state ----------
export interface SensorReading {
  sensorId: SensorId;
  metric: MetricType;
  value: number | null;               // null when offline — NEVER 0 as a placeholder
  unit: MetricUnit;
  timestamp: SimTimeMs;               // time of this reading (or of the last valid one if offline)
  lastValidValue: number | null;      // for greyed "last known" display
  lastValidAt: SimTimeMs | null;
  connection: ConnectionStatus;
  status: HealthStatus;
  explanation: string | null;         // set when status ≠ 'normal'
  source: 'simulated';                // [FUTURE] | 'device'
}

export type FanLevel = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BOOST';
export type DamperPosition = 'CLOSED' | 'MINIMUM' | 'PARTIAL' | 'OPEN';
export type DeviceKind = 'supply_fan' | 'exhaust_fan' | 'outdoor_air_damper';

export type DeviceState =
  | { kind: 'supply_fan'; level: FanLevel }
  | { kind: 'exhaust_fan'; level: FanLevel }
  | { kind: 'outdoor_air_damper'; position: DamperPosition };

export type ControlMode = 'auto' | 'manual' | 'emergency';

export interface ManualOverride {
  state: DeviceState;
  setAt: SimTimeMs;
  expiresAt: SimTimeMs;
}

export interface VentilationDevice {
  id: DeviceId;
  floorId: FloorId;
  kind: DeviceKind;
  name: string;                       // 'Supply Fan F07'
  state: DeviceState;
  mode: ControlMode;
  manualOverride: ManualOverride | null;
  lastChangedAt: SimTimeMs;
  lastChangeReason: string;
  lastRuleId: RuleId | null;
}

// ---------- Control ----------
export type RuleId =
  | 'R-EMERGENCY' | 'R-MANUAL' | 'R-SENSOR-FALLBACK' | 'R-IAQ-CRITICAL'
  | 'R-IAQ-WARNING' | 'R-THERMAL' | 'R-BASELINE';
export type ConstraintId = 'C-OUTDOOR-AIR';

export interface ControlContext {          // everything a rule may look at (read-only)
  floorId: FloorId;
  now: SimTimeMs;
  floorAggregates: Partial<Record<MetricType, { value: number; status: HealthStatus }>>; // valid data only
  outdoor: OutdoorConditions;
  devices: Record<DeviceKind, VentilationDevice>;
  emergency: EmergencyState | null;
}

export interface ControlRequest {
  ruleId: RuleId;
  priority: number;
  deviceKind: DeviceKind;
  target: DeviceState;
  reason: string;                          // human-readable
}

export interface ControlRule {             // rules are code + metadata
  id: RuleId;
  name: string;
  priority: number;
  description: string;                     // shown in the "Why?" inspector
  evaluate(ctx: ControlContext): ControlRequest[];   // pure
}

export interface ControlDecision {
  deviceId: DeviceId;
  evaluatedAt: SimTimeMs;
  candidates: ControlRequest[];
  winningRuleId: RuleId | null;
  requestedState: DeviceState | null;
  constrainedState: DeviceState | null;
  constraintsApplied: { id: ConstraintId; note: string }[];
  outcome: 'applied' | 'unchanged' | 'held_by_dwell' | 'manual' | 'recommendation_only' | 'emergency';
  reason: string;
}

export interface ControlState {
  autoMode: boolean;
  outdoorAirRestricted: boolean;
  fallbackFloors: FloorId[];
  emergency: EmergencyState | null;
}

export interface EmergencyState { fireFloorId: FloorId; startedAt: SimTimeMs }

export interface OutdoorConditions {
  temperature: number | null;
  humidity: number | null;
  pm25: number | null;
  co2: number;                             // configured constant
}

// ---------- Alerts (live state) ----------
export type AlertType =
  | 'threshold' | 'sensor_offline' | 'sensor_invalid'
  | 'outdoor_air_restricted' | 'control_degraded' | 'emergency';

export interface Alert {
  id: AlertId;
  key: string;                             // dedupe key, e.g. 'threshold:co2:F02'
  type: AlertType;
  severity: Exclude<Severity, 'info'>;     // 'warning' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved';
  scope: { floorId?: FloorId; areaId?: AreaId; sensorId?: SensorId; metric?: MetricType };
  title: string;                           // 'High CO₂ — Floor 2'
  message: string;                         // includes value and threshold
  raisedAt: SimTimeMs;
  updatedAt: SimTimeMs;
  acknowledgedAt: SimTimeMs | null;
  resolvedAt: SimTimeMs | null;
  peakValue: number | null;
}

// ---------- Events (historical, append-only) ----------
export type SystemEventType =
  | 'SIMULATION_STARTED' | 'SIMULATION_PAUSED' | 'SIMULATION_RESET' | 'SPEED_CHANGED'
  | 'SCENARIO_STARTED' | 'SCENARIO_STEP' | 'SCENARIO_COMPLETED' | 'SCENARIO_STOPPED'
  | 'SENSOR_DISCONNECTED' | 'SENSOR_RECONNECTED' | 'SENSOR_INVALID_READING'
  | 'ALERT_RAISED' | 'ALERT_ESCALATED' | 'ALERT_DEESCALATED' | 'ALERT_RESOLVED' | 'ALERT_ACKNOWLEDGED'
  | 'DEVICE_STATE_CHANGED'
  | 'MANUAL_OVERRIDE_SET' | 'MANUAL_OVERRIDE_CLEARED' | 'MANUAL_OVERRIDE_EXPIRED'
  | 'AUTO_MODE_ENABLED' | 'AUTO_MODE_DISABLED'
  | 'CONTROL_CONSTRAINT_ACTIVE' | 'CONTROL_CONSTRAINT_CLEARED'
  | 'CONTROL_FALLBACK_ACTIVE' | 'CONTROL_FALLBACK_CLEARED'
  | 'EMERGENCY_STARTED' | 'EMERGENCY_ENDED';

export interface SystemEvent {
  id: EventId;
  seq: number;                             // monotonically increasing; stable ordering
  timestamp: SimTimeMs;
  type: SystemEventType;
  category: 'simulation' | 'scenario' | 'sensor' | 'alert' | 'control' | 'operator';
  severity: Severity;
  message: string;                         // one-line, human-readable
  floorId?: FloorId;
  deviceId?: DeviceId;
  sensorId?: SensorId;
  alertId?: AlertId;
  ruleId?: RuleId;
  trigger?: string;                        // e.g. 'CO₂ 1,240 ppm ≥ 1,000 (warning)'
  previousState?: DeviceState;
  newState?: DeviceState;
  reason?: string;                         // full explanation
  actor: 'system' | 'operator' | 'scenario';
}

// ---------- Scenarios ----------
export type ScenarioAction =
  | { type: 'setOccupancy'; areaIds: AreaId[]; fraction: number; rampMs?: number }
  | { type: 'setHeatGain'; floorIds: FloorId[]; value: number; rampMs?: number }
  | { type: 'pulseSource'; areaIds: AreaId[]; metric: 'voc' | 'pm25'; rate: number; durationMs: number }
  | { type: 'setOutdoor'; values: Partial<Omit<OutdoorConditions, 'co2'>>; rampMs?: number }
  | { type: 'disconnectSensor'; sensorIds: SensorId[] }
  | { type: 'reconnectSensor'; sensorIds: SensorId[] | 'all' }
  | { type: 'injectInvalidReading'; sensorId: SensorId; value: number }
  | { type: 'startEmergency'; fireFloorId: FloorId }
  | { type: 'restoreBaselineInputs'; rampMs: number };

export interface ScenarioStep { atMs: number; label: string; action: ScenarioAction }

export interface SimulationScenario {
  id: ScenarioId;
  name: string;
  description: string;
  startsFrom: 'baseline' | 'current';      // 'current' only for 'recovery'
  requiresConfirmation: boolean;           // true for 'fire-emergency'
  steps: ScenarioStep[];
  completion: { afterMs: number } | { when: 'allNormal' };
  expected: {                              // documentation + used by integration tests
    alerts: string[];                      // alert keys expected to be raised
    events: SystemEventType[];             // expected to appear, in this relative order
  };
}

// ---------- Snapshot published to the UI ----------
export type SimulationSpeed = 1 | 2 | 5 | 10;

export interface LiveSnapshot {
  simTime: SimTimeMs;
  simulation: { running: boolean; speed: SimulationSpeed; seed: number; activeScenario: { id: ScenarioId; startedAt: SimTimeMs; progress: number } | null };
  readings: Record<SensorId, SensorReading>;
  devices: Record<DeviceId, VentilationDevice>;
  decisions: Record<DeviceId, ControlDecision>;
  control: ControlState;
  // Outdoor conditions are NOT duplicated here: derive them from the OUT-* readings with a selector
  // (selectOutdoorConditions), the same helper the runtime uses to build ControlContext.outdoor.
  alerts: { active: Alert[]; recentResolved: Alert[] };   // bounded
  events: SystemEvent[];                                  // bounded ring buffer, newest last
  history: TrendHistory;                                  // bounded
}

export interface TrendPoint { t: SimTimeMs; value: number | null }
export type TrendHistory = Record<FloorId, Record<MetricType, TrendPoint[]>>;
```

### 10.1 How the models relate

```
Building 1──* Floor 1──* Area 1──* Sensor ──(latest)── SensorReading   (live)
                  │
                  └──* VentilationDevice ──(latest)── ControlDecision    (live)

SensorReading ──classified──▶ HealthStatus ──aggregated──▶ Area/Floor/Building status (derived, not stored)
Floor aggregates + Outdoor + Devices ──▶ ControlRule.evaluate ──▶ ControlRequest ──▶ ControlDecision ──▶ DeviceState
Sustained non-normal status ──▶ Alert (live; one per key)
Every meaningful change ──▶ SystemEvent (history; append-only, bounded)
SimulationScenario ──steps──▶ simulation inputs / faults / emergency
```

### 10.2 Live state vs. history

| Kind | Examples | Lifetime | Mutable? |
|------|----------|----------|----------|
| **Static config** | Building, Floor, Area, Sensor, thresholds, rules | Whole session | No (imported constants) |
| **Live state** | latest `SensorReading`, `VentilationDevice.state`, active `Alert`s, latest `ControlDecision`, `ControlState` | Replaced each step | Replaced immutably by the runtime |
| **History** | `SystemEvent` log, resolved alerts, `TrendHistory` | Bounded ring buffers | Append-only |
| **Derived** | area/floor/building status, counts, filtered lists | Computed on read | Never stored (memoized selectors) |
| **UI state** | selected floor/sensor, filters, open panels | Session | `uiStore` only |

**Avoid duplication:** floor/building statuses are *derived* from readings, not stored separately. Configuration is
never copied into the snapshot — the snapshot references entities by ID.

---

## 11. Real-Time and Performance Strategy

### 11.1 Clock and determinism

- **One clock, one loop.** `LocalSimulationRuntime` owns the only simulation timer (`setInterval`). Components must
  never create their own simulation timers.
- **Fixed step:** each step advances simulated time by `dt = 1000 ms`. Speed changes how many steps run per real
  second, not the step size — this keeps results identical at any speed.

  | Speed | Steps per real second | Publish rate |
  |------:|----------------------:|-------------:|
  | 1× | 1 | 1 Hz |
  | 2× | 2 | 2 Hz |
  | 5× | 5 (batched) | ≤ 5 Hz |
  | 10× | 10 (batched in groups) | ≤ 5 Hz |

- **Seeded PRNG** (e.g. `mulberry32`) in `domain/simulation/rng.ts`. Given the same seed, scenario, and number of
  steps, the simulation produces identical readings — this is what makes demos and tests reproducible.
- **Simulated time** starts at a configured date/time (e.g. a weekday at 09:00) and is used for all timestamps.
  Domain code never calls `Date.now()` or `Math.random()`.
- When the browser tab is hidden, browsers throttle timers; the runtime does **not** try to "catch up" with a burst
  of steps — it simply continues (documented behavior). Optionally pause while hidden (decide in Phase 4).

### 11.2 React rendering strategy

- The store adapter calls `liveStore.setState(snapshot)` **once per publish** (React batches the resulting renders).
- Components subscribe with **narrow selectors** (e.g. `useLiveStore(s => s.readings['F07-A-co2'])`) and
  `useShallow` for small objects/arrays, so a component re-renders only when *its* data changed.
- The snapshot uses **structural sharing** (unchanged devices/alerts keep the same references) so selectors stay cheap.
- Expensive derived data (filtered alert lists, floor aggregates) uses memoized selectors.
- **3D render loop:** `useFrame` reads the latest state via `useLiveStore.getState()` or refs — **not** React state —
  for per-frame animation (fan rotation, particles). React re-renders the scene graph only when structure or
  selection changes.

### 11.3 3D performance budget

| Target | Budget |
|--------|--------|
| Frame rate | ~60 fps on a mid-range laptop with integrated graphics at 1080p; never below ~30 fps during demos. |
| Draw calls | < ~300; use **instancing** for sensor nodes, fan blades, and airflow particles. |
| Particles | ≤ ~2,000 instanced particles total; scale with device airflow; off under reduced motion. |
| Pixel ratio | Clamp `dpr` to `[1, 1.75]`; optionally adapt down if frame rate drops (Drei `PerformanceMonitor`). |
| Shadows | Off by default. |
| Allocation | No object allocation inside `useFrame` (reuse vectors/colors). |
| Loading | 3D feature is code-split (`React.lazy`) so the dashboard shell appears before the 3D chunk loads. |
| Cleanup | Dispose custom geometries/materials/textures not managed by R3F; handle WebGL context loss → fallback. |

### 11.4 Bounded memory

| Buffer | Bound (default) |
|--------|-----------------|
| Event log | 500 most recent events (ring buffer) |
| Resolved alerts | 100 most recent |
| Trend history | 300 points per floor per metric (5 min at 1×) → 12 × 5 × 300 = 18,000 points max |
| Decision traces | latest one per device only |

The event timeline renders the latest ~50 entries; the full history view paginates or virtualizes if needed.

### 11.5 Robustness

- Every `setInterval`, subscription, and event listener has a matching cleanup (`runtime.stop()`, unsubscribe
  functions, `useEffect` cleanups). React StrictMode double-mounting must not create two loops (runtime is created
  once at app bootstrap, outside components, or guarded).
- Invalid/disconnected readings are handled by classification (§5.6) and never crash rendering (`value: null` is a
  first-class case in every component).
- Error boundaries isolate the 3D scene and each major panel.

### 11.6 Honest scalability statement

The prototype is a single-user, in-browser simulation. It makes **no claim** about concurrent-user capacity. Such
claims require a real backend and load testing (§15.3).

---

## 12. Testing and Acceptance Criteria

### 12.1 Strategy

| Level | Tooling | Focus |
|-------|---------|-------|
| Unit (domain) | Vitest | Classification, aggregation, rules, resolution, constraints, safeguards, alert evaluator, event buffer, PRNG determinism, scenario engine. **Highest priority** — this is where bugs hide. |
| Integration (domain) | Vitest | Run the `LocalSimulationRuntime` headlessly for N steps per scenario; assert alerts, device states, and event order. |
| Component | Vitest + React Testing Library | Rendering of critical states, key interactions (select floor, toggle auto mode, manual override, start/reset scenario, acknowledge alert). |
| 3D | Manual + light smoke test | Scene mounts without errors (WebGL is not available in jsdom → test the fallback path and keep logic out of 3D components). |
| Build | `npm run build` + `npm run typecheck` | No type errors; production bundle builds. |
| Manual demo check | Checklist (§12.4) | All 8 scenarios behave as specified in the browser. |

Planned npm scripts (created in Phase 1): `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `lint`, `format`,
`test` (watch), `test:run` (CI-style single run), `test:coverage` (optional).

### 12.2 Required test cases

**Sensor threshold classification**
- [ ] Each metric: value below warning → `normal`; at warning-enter → `warning`; at critical-enter → `critical`.
- [ ] Hysteresis: `warning` stays `warning` between exit and enter; recovers to `normal` only below exit.
- [ ] De-escalation `critical → warning` respects critical-exit; skipping straight to `normal` when far below.
- [ ] Two-sided metrics (temperature/humidity) classify low-side and high-side correctly.
- [ ] Explanations contain the value and the threshold crossed.

**Invalid or disconnected readings**
- [ ] `offline` connection → `status: 'offline'`, `value: null`, never `0`.
- [ ] Out-of-range, `NaN`, `Infinity`, CO₂ = 0 → `invalid`.
- [ ] Aggregation ignores offline/invalid sensors; floor with no valid CO₂ → aggregate absent (not zero).
- [ ] Stale → offline transition after the configured timeouts.

**Rule priority and conflicts**
- [ ] Higher-priority request wins (e.g. `R-IAQ-CRITICAL` over `R-THERMAL`).
- [ ] Same priority → more ventilation wins; deterministic tie-break.
- [ ] `C-OUTDOOR-AIR` clamps damper to `MINIMUM`; reason mentions the constraint.
- [ ] Indoor PM2.5 with restricted outdoor air → filtration behavior (§6.5).
- [ ] Free cooling only when outdoor is ≥ 2 °C cooler and not restricted.
- [ ] `R-SENSOR-FALLBACK` fires only when **all** CO₂ sensors on the floor lack valid data.
- [ ] `R-EMERGENCY` overrides manual overrides and the outdoor-air constraint.

**Hysteresis and repeated-action prevention**
- [ ] Condition must persist `alertDebounceSteps` before action.
- [ ] Same target as current → no command, no event.
- [ ] Decreases blocked until `minStateHoldMs`; critical escalation bypasses the hold.
- [ ] Step-down happens one level at a time.
- [ ] A reading oscillating ±5 ppm around 1000 does not produce repeated events.

**Automatic/manual mode**
- [ ] Auto OFF → decisions are `recommendation_only`; device states unchanged; alerts still raised.
- [ ] Manual override holds state; engine skips device; override expires after timeout; Return-to-auto works.
- [ ] Manual commands rejected during emergency with a reason.
- [ ] Ending emergency clears overrides and logs it.

**Scenario activation and reset**
- [ ] Each scenario (S1–S8) run headlessly produces its expected alert keys and event types in relative order (§7.2).
- [ ] Same seed + scenario → identical snapshots after N steps (determinism).
- [ ] Starting a scenario performs a soft reset (except Recovery).
- [ ] Hard reset restores baseline and clears alerts, overrides, history, and events (except the `SIMULATION_RESET` entry).
- [ ] Recovery is rejected while an emergency is active.

**Event logging**
- [ ] Every device change (auto, manual, emergency) produces exactly one `DEVICE_STATE_CHANGED`/`MANUAL_OVERRIDE_SET` with previous state, new state, timestamp, rule/actor, and reason.
- [ ] `seq` strictly increases; ring buffer drops oldest beyond the bound.

**Components and critical UI states**
- [ ] App shell renders with the SIMULATED badge.
- [ ] Selecting a floor in the floor rail updates the floor details panel.
- [ ] Offline sensor renders "No data", not 0.
- [ ] Empty alerts state renders the empty message.
- [ ] Emergency banner renders with disclaimer; manual controls disabled.
- [ ] Auto-mode toggle dispatches the command and reflects the new state.
- [ ] WebGL-unavailable path renders the 2D floor stack.

### 12.3 Definition of Done (every phase)

A phase is complete only when **all** are true:

1. [ ] The application runs (`npm run dev`) without console errors.
2. [ ] The phase's functionality works as specified.
3. [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build` pass — **actually executed**, with results reported.
4. [ ] No known critical errors remain (known minor issues are listed).
5. [ ] The developer can inspect and understand the changes (summary + plain-English explanation of key decisions).
6. [ ] The phase summary is delivered and the developer has **approved** before the next phase starts.

### 12.4 Manual demo verification checklist (Phase 7)

- [ ] Fresh load → S1 state within 3 s on the presentation laptop.
- [ ] Each of S1–S8 behaves as §7.2 describes at 1× and at 5×.
- [ ] Demo script (§7.3) runs end-to-end twice in a row with identical outcomes.
- [ ] Reset simulation always returns to S1.
- [ ] Works in latest Chrome and Edge (and Firefox as a secondary check); fallback verified with WebGL disabled.
- [ ] Reduced-motion mode verified.

---

## 13. Phased Implementation Roadmap

Each phase lists owners (§14.1), scope, deliverables, and acceptance criteria. **Work on one phase at a time.
Stop after each phase for developer review.**

### Phase 0 — Planning ✅ (this document)

- **Owner:** Lead Software Architect.
- **Deliverable:** `CLAUDE.md`.
- **Acceptance:** [ ] Developer has reviewed and approved this document (or requested changes).

### Phase 1 — Frontend foundation

- **Owner:** Lead Architect (setup, boundaries) + Senior Frontend Engineer (combined with UI/UX).
- **Scope:**
  - [ ] Scaffold Vite + React + TypeScript (strict) in the repository root (inspect existing files first; keep `README.md` and `CLAUDE.md`).
  - [ ] Verify and record dependency versions (Appendix B); install only Phase 1 needs: React, TS, Vite, Tailwind, Zustand, Vitest, RTL, jsdom, ESLint, Prettier, lucide-react. (3D and chart libraries are installed in their phases.)
  - [ ] Create the directory skeleton (§9.3) and ESLint boundary rules.
  - [ ] `tokens.css` with all design tokens (§8.3–8.5) wired into Tailwind.
  - [ ] Empty `domain/types` module ready for Phase 2; `uiStore` skeleton.
  - [ ] Responsive app shell: top status bar (title + SIMULATED badge), placeholder regions for the main layout (labeled, non-interactive, no fake controls).
  - [ ] npm scripts (§12.1); one smoke test (shell renders) and one trivial domain test.
  - [ ] `.gitignore` (node_modules, dist, coverage, env files).
- **Acceptance:** [ ] `npm run dev` shows the shell · [ ] typecheck, lint, test, build pass · [ ] boundary lint rule catches a deliberate violation (verified, then removed) · [ ] layout responds at 375 / 768 / 1280 / 1920 px.

### Phase 2 — Dashboard UI (mock data)

- **Owner:** Senior Frontend Engineer + UI/UX; QA for tests.
- **Scope:**
  - [ ] Implement all shared types (§10) and building/threshold/control config (§5).
  - [ ] `classifyReading` + aggregation helpers with full unit tests (§12.2).
  - [ ] A static `mockSnapshot` built from config (realistic values, including one warning floor, one offline sensor, a few mock events/alerts) loaded into `liveStore` through the same adapter shape the runtime will use.
  - [ ] UI primitives (`components/ui`).
  - [ ] Status bar (global status, alert count, auto-mode indicator), 2D floor stack/rail (doubles as future fallback), selected-floor details, device list (read-only states), active alerts list, recent-events timeline.
  - [ ] Loading/empty/offline states for these components.
- **Not in scope:** live updates, 3D, charts, controls that change state (auto toggle and manual override arrive in Phase 5; they are shown as read-only indicators here).
- **Acceptance:** [ ] Selecting a floor updates details · [ ] Offline sensor shows "No data" · [ ] No hard-coded thresholds in components · [ ] classification tests pass · [ ] AA contrast spot-checked · [ ] DoD (§12.3).

### Phase 3 — Interactive 3D building

- **Owner:** 3D Visualization Engineer; Frontend Engineer for integration; Performance review by Architect.
- **Scope:**
  - [ ] Install and verify R3F/Drei/Three versions compatible with the React version.
  - [ ] Lazy-loaded 3D canvas with error boundary and WebGL detection → fallback to 2D floor stack.
  - [ ] Building generated from config: slabs, core, cutaway façade, area footprints, rooftop plant.
  - [ ] Orbit/zoom with limits, default framing, Reset view; camera focuses selected floor (damped).
  - [ ] Floor selection in 3D ↔ floor rail sync (via `uiStore`); hover feedback.
  - [ ] Sensor nodes (instanced) colored by status from mock snapshot; selection with `Html` label.
  - [ ] Device models showing static states from mock data (animation in Phase 5).
  - [ ] Reduced-motion handling for camera.
- **Acceptance:** [ ] 12 floors render from config (and 6 / 20 floors when config changes) · [ ] floor & sensor selection works both ways · [ ] fallback renders with WebGL disabled · [ ] ~60 fps on dev laptop with no console errors · [ ] DoD.

### Phase 4 — Live sensor simulation

- **Owner:** Real-Time Simulation Engineer; QA.
- **Scope:**
  - [ ] Seeded PRNG, simulation clock, fixed-step loop with play/pause/speed.
  - [ ] Environment model (§5.8) with baseline occupancy profile; constants tuned for visible behavior.
  - [ ] Sensor reading generation, validity checks, staleness/offline, fault-injection API (used later by scenarios).
  - [ ] `AerisRuntime` + `LocalSimulationRuntime` + store adapter replacing `mockSnapshot`.
  - [ ] Alert evaluator (raise/escalate/de-escalate/resolve with debounce); event ring buffer; trend history buffers.
  - [ ] Status bar simulation controls (play/pause/speed) and live indicator.
  - [ ] Devices stay at baseline (no control engine yet).
- **Acceptance:** [ ] Values update live without reload · [ ] determinism test passes · [ ] single timer verified (no duplicates under StrictMode) · [ ] alerts raise/resolve correctly in tests · [ ] buffers bounded · [ ] DoD.

### Phase 5 — Automatic ventilation control

- **Owner:** Real-Time Simulation Engineer (control engine); Frontend for controls & "Why?" inspector; 3D Engineer for device animation; QA.
- **Scope:**
  - [ ] Rules (§6.3), resolution (§6.4), constraints, safeguards (§6.6), `applyDeviceCommand` with event logging.
  - [ ] Auto-mode toggle, manual override + return-to-auto + expiry (§6.7), command validation.
  - [ ] "Why?" decision inspector; event timeline shows reasons.
  - [ ] 3D: fan spin speed, damper louvers, airflow particles bound to device state (reduced-motion aware).
  - [ ] Emergency engine support (`R-EMERGENCY`) implemented and unit-tested (UI trigger arrives in Phase 6).
- **Acceptance:** [ ] All control tests in §12.2 pass · [ ] no oscillation in a 10-minute 10× soak run (manually observed and via test) · [ ] every device change visible in event history with reason · [ ] DoD.

### Phase 6 — Scenarios, charts, and alerts

- **Owner:** Simulation Engineer (scenario engine + definitions); Frontend + UI/UX (charts, alert UI, scenario panel, emergency banner); QA.
- **Scope:**
  - [ ] Scenario engine + S1–S8 definitions (§7); soft/hard reset; progress display; confirmation dialogs.
  - [ ] Emergency UI: disclaimer dialog, banner, disabled manual controls, End emergency.
  - [ ] Trend chart for the selected floor with metric switcher and threshold bands (install Recharts here).
  - [ ] Alert filtering (severity/floor/metric/status), acknowledge, resolved history.
  - [ ] Full event history view with filtering.
- **Acceptance:** [ ] Each scenario's headless integration test passes · [ ] each scenario manually verified in the browser · [ ] charts update smoothly · [ ] DoD.

### Phase 7 — Quality and presentation

- **Owner:** QA & Test Engineer + Performance & Reliability (combined with Architect); UI/UX for polish.
- **Scope:**
  - [ ] Responsive polish (tablet/phone), accessibility checklist (§8.8), contrast verification.
  - [ ] Performance pass against §11.3 budgets; memory check during a long run.
  - [ ] Error handling review (error boundaries, WebGL context loss).
  - [ ] README: what AERIS is, how to run, architecture overview, demo script, disclaimers.
  - [ ] Demo verification checklist (§12.4).
- **Acceptance:** [ ] All checklists complete · [ ] two consecutive clean demo rehearsals · [ ] DoD.

### Future phases — **[FUTURE, NOT APPROVED]**

Phase 8+ (only with explicit approval): Node.js backend + `RemoteRuntime` over WebSocket; PostgreSQL persistence;
authentication and RBAC; MQTT ingestion; multiple buildings; deployment. Owner: Backend & IoT Engineer. See §15.3.

---

## 14. Development Workflow and Claude Code Rules

### 14.1 Multi-agent development team

The **Lead Software Architect** owns technical direction, task decomposition, integration contracts, and review
coordination. Specialist roles:

| # | Role | Responsibilities | Active in phases |
|---|------|------------------|------------------|
| 1 | Senior Frontend Engineer | React, TypeScript, app structure, dashboard components, state, responsive UI. | 1, 2, 3 (integration), 5, 6, 7 |
| 2 | 3D Visualization Engineer | Three.js, R3F, digital twin, floors, sensors, devices, 3D performance. | 3, 5 (animation), 7 |
| 3 | Real-Time Simulation Engineer | Sensor simulation, scenario orchestration, control rules, alerts, event history. | 4, 5, 6 |
| 4 | UI/UX & Motion Specialist | Visual hierarchy, tokens, accessibility, animation, interaction quality. *May be combined with Frontend in early phases.* | 1, 2, 6, 7 |
| 5 | QA & Test Engineer | Unit/integration/regression tests, edge cases, build verification. | 2–7 |
| 6 | Performance & Reliability Engineer | Rendering efficiency, update frequency, cleanup, memory, scalability. *May be combined with QA and Architect initially.* | 3, 5, 7 |
| 7 | Backend & IoT Engineer | API, auth, storage, WebSocket, MQTT, real sensor ingestion. **Future phase only, when explicitly approved.** | Future |

### 14.2 Agent activation policy

- Do **not** activate every specialist for every task; select agents according to the current approved phase.
- Plan and define contracts **before** implementation.
- Use separate specialist agents only for **genuinely separable** work (e.g. Phase 5: control engine vs. 3D animation).
- If subagents or multi-agent execution are unavailable, the Lead Architect performs the same responsibilities
  **sequentially**, and must **not** pretend that separate agents were launched.
- Do not begin a new implementation phase without explicit developer approval.

### 14.3 Task definition and file ownership

Every task must define:

- A **single accountable owner**.
- The **files/directories** the owner may modify.
- **Dependencies** on other tasks.
- **Expected outputs** and **acceptance criteria**.
- **Verification steps** (which commands/tests prove it works).

Avoid assigning multiple agents to modify the same files concurrently. Default ownership:

| Path | Default owner |
|------|---------------|
| `src/domain/types/`, `src/domain/config/`, `src/domain/runtime/` (interfaces) | Lead Architect (contracts) |
| `src/domain/simulation/`, `control/`, `alerts/`, `events/`, `scenarios/`, `history/` | Simulation Engineer |
| `src/features/building3d/` | 3D Visualization Engineer |
| `src/app/`, `src/components/ui/`, other `src/features/*`, `src/store/` | Frontend Engineer |
| `src/styles/tokens.css` | UI/UX Specialist (changes approved by Architect) |
| `**/*.test.ts(x)`, `src/test/` | QA Engineer (owners may add tests for their own code) |

### 14.4 Integration contracts

Before parallel work, the Lead Architect defines and freezes the relevant contracts: sensor readings/metadata;
building/floor/area/device models; control inputs/outputs; scenario activation/reset; alerts and events; data flow
between dashboard, simulation, and 3D (the `AerisRuntime` + `LiveSnapshot` + `AerisCommand` contract, §9.4).
Specialists must **not** independently redefine shared types, application-wide state, design tokens, or module
interfaces — they propose changes to the Architect, who updates `domain/types`, this document, and Appendix B.

### 14.5 Handoff report (each specialist, each task)

- What was implemented.
- Files changed.
- Public interfaces added or modified.
- Dependencies and assumptions.
- Tests and commands **actually executed** (with results).
- Known limitations and unresolved issues.

The Lead Architect verifies reports (re-runs checks, reads diffs) rather than trusting them blindly, and resolves
interface conflicts before integration.

### 14.6 Mandatory Claude Code working rules

1. **Read `CLAUDE.md`** before performing project work.
2. Follow the documented scope and architecture. **Do not silently expand scope.**
3. Work on **only one approved phase** at a time.
4. **Before each phase:** summarize intended changes, list files to be created/modified, and identify risks.
5. **Inspect existing files before modifying them.** Never overwrite without reading first.
6. Prefer **small, understandable changes** over large rewrites.
7. Never delete or replace working code without a clear, stated reason.
8. **Never claim** a command, test, or build succeeded unless it was **actually run and verified**. Report failures honestly with output.
9. Explain errors honestly and propose the **smallest reasonable fix**.
10. Keep dependencies minimal; justify each new one; check compatibility before installing.
11. Avoid unnecessary abstractions and premature optimization.
12. Do not expose secrets or commit credentials (none are needed for the prototype).
13. **Do not connect to real sensors, networks of devices, or safety equipment** without explicit approval.
14. **After each phase**, report: changed files, implemented features, verification results (commands + outcomes),
    known limitations, and the next proposed phase. Update the Progress Tracker.
15. **Stop and wait for explicit developer approval** before beginning the next phase.
16. Keep this document truthful: if implementation must deviate from it, propose the change, get approval, and
    update the relevant section and Appendix B.
17. **Code comments are written in Mongolian** (simple, correct Mongolian that the developer can read and explain).
    Identifiers (variables, functions, types, files) and commit messages stay in **English**.

### 14.7 Quality gates (after each phase)

1. Integrate specialist work.
2. Run `typecheck`, `lint`, `test:run`, and `build` (and `dev` smoke check).
3. Check for type errors, runtime console errors, and broken interactions.
4. Review visual consistency (tokens, states) and performance (§11.3).
5. Resolve critical regressions.
6. Summarize the result and **wait for developer approval**.

### 14.8 Git workflow

- Work on a branch per phase (e.g. `phase-1-foundation`); keep `main` working.
- Small, descriptive commits (imperative mood: "Add CO₂ hysteresis classification").
- Commit only verified work; never commit `node_modules`, build output, or secrets.
- Do not force-push shared branches. Open pull requests or push only when the developer asks.

### 14.9 Communicating with the developer

The developer is a third-year AI/ML student learning web development through practical work.

- Explain important architectural decisions **in plain English**, connected to concrete examples in this project
  (e.g. "the control engine is a pure function, so we can test 'CO₂ at 1,240 ppm' without opening a browser").
- Don't assume expert full-stack knowledge; define jargon on first use (Appendix A helps).
- Keep summaries step-by-step and focused on visible progress.
- Keep the project technically sound **without** making it unnecessarily complicated.

---

## 15. Assumptions, Risks, and Future Extensions

### 15.1 Assumptions (explicit — revisit during review)

| # | Assumption |
|---|------------|
| A1 | The repository was empty except for a one-line `README.md` (`# Airsy`) at the time of planning; no existing code, config, or constraints. |
| A2 | Single developer, solo project; no deadline was provided — phases are sized for roughly 1–2 weeks of part-time work each. |
| A3 | The demo runs on a modern laptop in the latest Chrome or Edge with WebGL2; Node.js current LTS (≥ 20) for development. |
| A4 | English UI only; metric units only (°C, ppm, % RH, µg/m³). |
| A5 | One fictional building ("AERIS Tower"), 12 floors, 2 areas per floor, 3 devices per floor. |
| A6 | Thresholds (§5.5) are demonstration values, not compliance standards. |
| A7 | The simulation model (§5.8) is illustrative, not physically accurate. |
| A8 | No backend, persistence, or auth in Phases 1–7; refreshing the page restarts the simulation from baseline. |
| A9 | npm is the package manager; Tailwind CSS is acceptable to the course (if the course requires plain CSS/SCSS, swap Tailwind and keep tokens as CSS variables — the token design is unaffected). |
| A10 | The course does not require a specific framework other than modern web technologies; React + TypeScript is acceptable. |

### 15.2 Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Scope creep (too many features, polish too early) | Unfinished project | Strict phases, non-goals list, approval gates. |
| 3D performance on the presentation laptop | Choppy demo | Budgets (§11.3), instancing, dpr clamp, reduced-motion & 2D fallback, test on the actual laptop in Phase 3. |
| R3F/Drei ↔ React version incompatibility | Install/build failures | Verify peer dependencies in Phase 1/3; record versions. |
| Simulation tuning makes scenarios too slow/fast or noisy | Unconvincing demo | Constants centralized; speed control; headless scenario tests; rehearsals. |
| Control oscillation | Looks buggy | Hysteresis, debounce, dwell, step-down pacing, soak test. |
| Too many events (noise) during emergency | Unreadable timeline | Group related events in the UI; events only on change. |
| Learning curve (3D, state management) | Slow progress | Small steps, plain-English explanations, keep 3D logic-free. |
| Misinterpretation of emergency feature as real safety guidance | Ethical/safety concern | Prominent disclaimers (§6.9), confirmation dialog, explicit labeling. |
| Over-engineering for a future backend | Complexity | Only the `AerisRuntime` seam and serializable models; no backend code until approved. |

### 15.3 Future extensions — **[FUTURE, NOT PART OF THE PROTOTYPE]**

- **Backend:** Node.js (e.g. Fastify/Express) server running the same domain modules; `RemoteRuntime` client over
  WebSockets/Socket.IO; snapshot + delta streaming.
- **Persistence:** PostgreSQL for events, alerts, readings (consider TimescaleDB for time series).
- **IoT ingestion:** MQTT broker; sensor messages normalized to `SensorReading`; device commands via MQTT topics.
- **Security:** authentication, role-based access (viewer / operator / admin), audit logging of commands.
- **Multi-building & multi-user:** building selector, server-authoritative state, optimistic UI for commands.
- **Analytics:** longer history, reports, energy-use estimates, anomaly detection (the developer's AI/ML interest
  fits here — e.g. forecasting CO₂ from occupancy).
- **Hardware pilots:** a single low-cost CO₂ sensor (e.g. NDIR sensor on a microcontroller) feeding one area —
  **only** for non-safety monitoring, with explicit approval.
- Scalability claims only after load testing.

---

## Appendix A — Glossary

| Term | Plain-English meaning |
|------|-----------------------|
| **Digital twin** | A live virtual model of a physical thing (here, a building) that mirrors its state. |
| **IAQ** | Indoor Air Quality — how healthy and comfortable indoor air is (CO₂, particles, VOCs, temperature, humidity). |
| **CO₂ (ppm)** | Carbon dioxide in parts per million. People exhale CO₂, so high indoor CO₂ means "not enough fresh air for the number of people". Outdoor air is ~420 ppm. |
| **PM2.5** | Tiny particles ≤ 2.5 micrometres (smoke, pollution) measured in µg/m³. |
| **VOC** | Volatile Organic Compounds — gases from cleaning products, paints, furniture. AERIS uses a simulated relative index. |
| **Supply fan / exhaust fan** | Fans that push air into / pull air out of a floor. |
| **Outdoor-air damper** | Adjustable louvers that control how much fresh outside air is mixed into the supply air. |
| **Recirculation / filtration** | Re-using indoor air after passing it through filters (useful when outside air is polluted). |
| **Free cooling (economizer)** | Using cooler outside air to cool the building instead of mechanical cooling. |
| **Hysteresis** | Different thresholds for "turning on" and "turning off" an alarm/action, so values hovering near a threshold don't cause flickering. |
| **Debounce** | Requiring a condition to persist for a short time before reacting, to ignore brief spikes. |
| **Dwell / minimum hold time** | After changing, a device stays in its new state for a minimum time before stepping down. |
| **Pressurization (smoke control)** | Pushing air into spaces next to a fire so smoke is less likely to flow into them. Real designs are engineered per building. |
| **Seeded PRNG** | A "random" number generator that produces the same sequence every time from the same starting number (seed) — makes demos repeatable. |
| **Selector (Zustand)** | A function that picks a small piece of the store, so a component only re-renders when that piece changes. |
| **Instancing (3D)** | Drawing many copies of the same object in one GPU call — much faster than drawing each separately. |
| **Structural sharing** | When creating a new state object, reusing unchanged parts by reference so comparisons are cheap. |

---

## Appendix B — Decision Log

Record significant decisions here (date, decision, reason, alternatives considered).

| # | Date | Decision | Reason | Alternatives |
|---|------|----------|--------|--------------|
| D1 | 2026-10-18 | Frontend-only simulation for Phases 1–7. | Achievable scope; demo reliability. | Early Node backend (rejected: scope). |
| D2 | 2026-10-18 | `AerisRuntime` interface between UI and data source. | Enables future WebSocket backend without UI rewrite. | UI reading simulation directly (rejected: coupling). |
| D3 | 2026-10-18 | Deterministic fixed-step simulation with seeded PRNG. | Reproducible demos and tests. | `Math.random` + wall-clock (rejected: unreproducible). |
| D4 | 2026-10-18 | Pure-TS domain layer, lint-enforced boundaries. | Testability; portability to server. | Logic in components/hooks (rejected). |
| D5 | 2026-10-18 | Zustand for state; CSS-variable design tokens + Tailwind. | Lightweight; selectors; single token source for UI and 3D. | Redux Toolkit (heavier); CSS-in-JS (runtime cost). |
| D6 | 2026-10-18 | One sensor per metric per area; one 3D marker per area. | Clear data model; uncluttered 3D. | Multi-metric "sensor node" entity (deferred). |
| D7 | 2026-10-18 | Emergency triggered only by a simulated alarm signal, never inferred from readings. | Safety realism and honesty. | Auto-detect fire from PM2.5 (rejected). |
| D8 | — | Exact dependency versions | *To be recorded in Phase 1.* | — |
| D9 | 2026-10-18 | Code comments in Mongolian; identifiers in English. | Developer's request: comments must be easy for the developer to read and explain. | English comments. |
