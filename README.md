# SalesRocket : Instant B2B Phone & Email Intelligence

SalesRocket is an enterprise B2B sales intelligence platform and Google Chrome / Opera browser extension designed for high-velocity sales prospecting, executive contact discovery, and MCA director intelligence.

---

## 🚀 Key Capabilities

1. **Instant Profile Discovery**:
   - Automatically detects active profiles on **LinkedIn** (`https://www.linkedin.com/in/*`) and **Zaubacorp** (`https://www.zaubacorp.com/*`).
   - Dynamically parses name, headline, current company, domain, and geographic location with 0ms latency.
2. **On-Demand Intelligence Reveal**:
   - **Mandatory Privacy & Credit Rule**: All three contact fields (**Direct Phone**, **Work Email**, **Secondary Personal Email**) start in a completely **hidden / unextracted** state.
   - Contact records are dynamically revealed only when the user clicks `⚡ Find All — Phone + Both Emails` or an individual extract button.
3. **Database Integration**:
   - Stores enriched leads directly in PostgreSQL / TimescaleDB schema `"SalesRocket".crm_leads` and `public.crm_leads`.
   - Captures `full_name`, `current_title`, `company_name`, `company_domain`, `work_email`, `mobile_phone`, `director_din`, `location`, `linkedin_url`, and raw JSON payloads.
4. **SuperAdmin Capabilities (`sachin.saxena@gmail.com`)**:
   - **Infinite Credits**: Always displays `Credits: ∞` with zero deductions or paywalls.
   - **Direct Database Purge**: Admin button allows one-click permanent hard-deletion of individual records from `"SalesRocket".crm_leads`.
5. **Interactive History Ledger & Dashboard**:
   - 100% pixel-perfect match to modern B2B intelligence tools.
   - Per-field instant copy buttons with green visual feedback toasts.
   - Direct WhatsApp dialer (`https://wa.me/...`).
   - Multi-channel Affiliate / Referral Modal (15% Commission).

---

## 📁 Repository & Server Architecture

| Component | Path / Location |
|---|---|
| **GitHub Repository** | `https://github.com/webmentixtechnologies/SalesRocket.git` |
| **Production Server** | `75.119.143.191` (`root@75.119.143.191:/root/SalesRocket`) |
| **Local Workspace** | `D:\WebMentix\22 Services\Antigravity\SalesRocket` |
| **CitadelValue Submodule** | `D:\WebMentix\22 Services\Antigravity\CitadelValue\extensions\citadel-lead-finder` |
| **Local Apache Server** | `D:\xampp\htdocs\SalesRocket` & `D:\xampp\htdocs\CitadelValue\extensions\citadel-lead-finder` |
| **Database Schema** | PostgreSQL `"SalesRocket".crm_leads` |

---

## 🛠️ How to Load Unpacked in Chrome / Opera

1. Open `chrome://extensions` (or `opera://extensions`).
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** and select this directory (or `extensions/citadel-lead-finder`).
4. Pin the **SalesRocket** extension to your toolbar.
5. Navigate to any LinkedIn profile (e.g. `https://www.linkedin.com/in/sauravnav/`) and click the side panel tab!
