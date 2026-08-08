<div align="center">

<img src="https://raw.githubusercontent.com/johncarlosionelo/sioneloflow/main/public/favicon.svg" width="96" alt="SioneloFlow" />

<h1 align="center" style="font-weight:800; letter-spacing:-0.02em; margin:10px 0 4px; line-height:1;">
  Sionelo<span style="background:linear-gradient(135deg,#22d3ee,#2dd4bf); -webkit-background-clip:text; background-clip:text; color:transparent;">Flow</span>
</h1>

<p style="font-size:1.15rem; font-weight:600; margin:6px 0 10px; line-height:1.4;">A water-billing engine that replaced a calculator, a spreadsheet, and a paper logbook.</p>

<p style="max-width:660px; margin:0 auto 18px; color:#57606a; line-height:1.7;">Two apartment buildings. Fifty rooms. One admin. SioneloFlow turns a monthly routine of meter readings and handwritten receipts into a single fast screen, with real-time billing math, one-click batch saves, and letter-page receipt printing.</p>

<p style="margin:18px 0 4px;">
  <a href="https://sioneloflow.pages.dev" style="display:inline-block; padding:12px 32px; background:linear-gradient(135deg,#22d3ee,#2dd4bf); color:#04121a; font-weight:800; border-radius:999px; text-decoration:none;">Try the live demo</a>
</p>

<p style="margin:0 0 22px; font-size:0.85rem; color:#8b949e;">(Admin access only)</p>

<p style="margin-top:24px;">
  <a href="https://www.typescriptlang.org/" style="text-decoration:none;"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-blueviolet.svg?style=flat-square"></a>
  <a href="https://vitejs.dev/" style="text-decoration:none;"><img alt="Vite" src="https://img.shields.io/badge/Vite-6-blueviolet.svg?style=flat-square"></a>
  <a href="https://supabase.com/" style="text-decoration:none;"><img alt="Supabase" src="https://img.shields.io/badge/Supabase-3-blueviolet.svg?style=flat-square"></a>
  <a href="https://www.cloudflare.com/" style="text-decoration:none;"><img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Pages-blueviolet.svg?style=flat-square"></a>
</p>

</div>

<hr style="height:1px; border:0; background:#d0d7de; max-width:760px; margin:36px auto;" />

## The problem

Billing two residences by hand meant a ritual every month:

- Walking floor to floor to read every meter and typing the numbers into separate spreadsheet tabs
- Computing consumption, volumetric charges, and surcharges on a calculator
- Writing out a paper receipt for each room
- Keeping a physical logbook that got messier and more error-prone every cycle

One wrong keystroke polluted the whole month. The spreadsheet had no guardrails, the logbook had no audit, and nothing survived a mistake.

## What SioneloFlow does

<table style="width:100%; border-collapse:separate;">
<tbody>
<tr>
<td width="50%" style="padding:18px 24px 18px 0; vertical-align:top;">

**Real-time billing math.** Consumption, volumetric charge, surcharge, and total update instantly as you type. Every value rounds to a whole peso, exactly like the original manual method. No formulas to maintain, no recalculation step.

</td>
<td width="50%" style="padding:18px 0 18px 24px; vertical-align:top;">

**One-click batch save.** Every edited room commits in a single upsert. No per-room saving, no half-saved months, no duplicate rows. The save is atomic and idempotent.

</td>
</tr>
<tr>
<td style="padding:18px 24px 18px 0; vertical-align:top;">

**Letter-page receipt engine.** Four receipts per page, formatted for standard letter paper. Empress rooms split across two physical sections print A-side then B-side to match the real logbooks.

</td>
<td style="padding:18px 0 18px 24px; vertical-align:top;">

**Ledger printing.** A clean database print view produces archivable ledger sheets straight from the browser, no PDF library involved.

</td>
</tr>
<tr>
<td style="padding:18px 24px 18px 0; vertical-align:top;">

**Layout that matches reality.** Room cards are organized by floor, building section, and gate wing, mirroring the physical layout of both buildings. The admin knows exactly where each card lives.

</td>
<td style="padding:18px 0 18px 24px; vertical-align:top;">

**Full audit trail.** Every save and every failure is written to the database. If something goes wrong, the log shows exactly what happened and when.

</td>
</tr>
</tbody>
</table>

## Engineering that matters

**Vanilla TypeScript on Vite, zero framework.** The UI is plain DOM with tight, typed modules. No React, no 300 KB runtime tax, no virtual DOM to fight. First paint is fast and every interaction is direct.

**Security is a policy, not a password.** Supabase Row-Level Security is the actual boundary. The public anon key ships in the bundle by design; RLS is what stops it. Unauthenticated reads return zero rows. Unauthenticated writes return 401. Deletes are rejected outright. The database is the gatekeeper, not the client.

**No delete in the app, on purpose.** The UI can only create and update. Data loss is a design bug, not a feature. Any removal happens deliberately in the database dashboard, never by accident in the app.

**Real authentication.** A single admin account behind Supabase Auth. Sessions live in memory only, so every visit starts locked. No persistent tokens on disk, no stale sessions.

**Printing done right.** Receipts and ledgers use native CSS print stylesheets tuned to letter dimensions. WYSIWYG in the browser, correct on paper, no server round-trip.

## Design

A dark glass interface with a cyan-to-teal accent palette, built mobile-first. Every surface has depth: layered cards, soft glows, hover states, and deliberate motion. The light theme swaps to a soft mist palette instead of harsh white.

Big interactions get choreography. Loading is a full-screen overlay with a clear message, so the user never wonders if the app is alive. Cards deal in with staggered animation after every load. It feels considered because it is.

## Tech stack

- **Frontend:** TypeScript + Vite, vanilla DOM
- **Styling:** Custom CSS, dark and light themes, glass design
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Hosting:** Cloudflare Pages with auto-deploy from GitHub
- **Printing:** Native CSS print stylesheets tuned for letter paper

<hr style="height:2px; border:0; background:linear-gradient(90deg,#22d3ee,#2dd4bf); max-width:180px; margin:42px auto;" />

<p align="center" style="font-weight:700; letter-spacing:0.02em; margin:0;">Built to replace a pen and a logbook. It does.</p>
