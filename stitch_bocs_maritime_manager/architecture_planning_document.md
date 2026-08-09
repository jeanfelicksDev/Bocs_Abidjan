# BOCS Maritime Management Platform - Architecture & Development Plan

## 1. Technical Architecture
- **Frontend:** React.js + Tailwind CSS (Robust, scalable, fast development).
- **State Management:** React Query (server state) + Zustand (client state).
- **Backend:** Node.js (Express) or Python (FastAPI).
- **Database:** PostgreSQL (Relational integrity for maritime logic).
- **Auth:** JWT with HTTP-only cookies.
- **File Processing:** `xml2js` for Manifests, `pdf-lib` for BL generation.

## 2. Database Schema (Core Entities)
- `Users`: id, email, password_hash, role (Admin, Agent, Billing, Client).
- `Escales` (Port Calls): id, vessel_name, voyage_no, eta, etd, status.
- `BillOfLading` (BL): id, bl_number, escale_id, type (Import/Export), status, shipper, consignee, notify, total_weight, volume.
- `Containers`: id, bl_id, container_number, type (20', 40', HC, RF), weight, gate_in, gate_out.
- `TarifSurestarie`: id, container_type, day_start, day_end, daily_rate.
- `Invoices`: id, bl_id, invoice_number, total_fcfa, total_usd, type (Proforma/Final), status (Draft, Paid).
- `Payments`: id, invoice_id, amount, payment_date, method.

## 3. Sprint Plan (30 Days / 5 Sprints)
- **Sprint 1 (Auth & Import):** Base setup, Manifest XML/PDF extraction, BL & Escale CRUD.
- **Sprint 2 (Demurrage & Billing):** Dmdt calculation engine, Proforma generation, Invoice conversion.
- **Sprint 3 (Export Module):** Client portal, Draft BL submission, Validation workflow.
- **Sprint 4 (Advanced Export & PDF):** Original BL PDF generation, Digital signature integration, Manifest consolidation.
- **Sprint 5 (Accounting & Reporting):** Dashboard, Aged balance, CSV exports, Final QA.

## 4. Electronic Signature Workflow
- **Solution:** Integrated "Stamp & Sign" using a digital image overlay for the maritime seal + cryptographic hashing for document integrity.
- **Storage:** Signed PDFs stored in S3/Cloud Storage with a reference in the DB.
- **Audit:** Every signature action logged in the `AuditTrail` table.