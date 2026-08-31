# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# Invoice Shipping Generator
### Commercial Invoice & Shipping Documents

**Version:** 1.1 — MVP  
**Status:** Product Planning  
**Platform:** Web Application  
**Deployment:** Cloudflare Pages Free  
**Repository:** GitHub  
**Database:** Supabase PostgreSQL  
**Authentication:** Supabase Auth  
**Frontend:** HTML + CSS + Vanilla JavaScript

---

# 1. PRODUCT VISION

**Invoice Shipping Generator** adalah aplikasi SaaS berbasis web untuk membuat Commercial Invoice dan Packing List untuk kebutuhan pengiriman barang, terutama export dan import.

Aplikasi dirancang dengan prinsip:

> **Simple when you want it simple. Powerful when you need it.**

User tidak dipaksa mengisi semua informasi yang tersedia.

User dapat membuat:

- Dokumen sederhana
- Dokumen lengkap
- Customs information
- Custom information sesuai kebutuhan
- PDF siap download

Arsitektur aplikasi sejak awal dibuat **modular**, sehingga fitur tambahan dapat dijual atau diaktifkan per user tanpa harus mengubah sistem authentication utama.

---

# 2. CORE MVP

Fitur utama MVP:

1. Login
2. Developer-controlled account
3. Account Active / Locked
4. Feature-based access control
5. Export / Import
6. Commercial Invoice
7. Packing List
8. Simple Template
9. Complete Template
10. Automatic document number
11. Manual document number
12. Product management
13. Customer management
14. Supplier management
15. Invoice history
16. Packing List history
17. PDF preview
18. PDF generation
19. PDF download
20. Suggested Customs Fields
21. Custom Fields
22. Temporary attachment
23. RLS security

---

# 3. FUTURE SELLING FEATURES

Aplikasi dirancang agar dapat berkembang menjadi platform shipping/trade tools.

Planned features:

### Document Features

- Commercial Invoice — Built
- Packing List — Built
- Proforma Invoice — Built
- Purchase Order — Built
- Sales Order — Built
- Shipping Instruction — Built
- Delivery Note — Built
- Quotation
- Certificate of Origin

(Status detail & roadmap lengkap: §65)

### Calculation / Research Tools

- Shipping Rate Checker
- Duty & Tax Calculator
- Landed Cost Calculator

### Future

- Carrier integrations
- Customs data integrations
- Accounting integrations
- ERP integrations
- AI-assisted documentation

---

# 4. TARGET USERS

### Primary

- Exporter
- Importer
- Trading Company
- Freight Forwarder
- Logistics Company
- SME
- International seller

### Secondary

- Export/import staff
- Sales staff
- Warehouse staff
- Shipping administration

---

# 5. TECHNOLOGY

## Frontend

HTML5  
CSS3  
Vanilla JavaScript

React tidak diperlukan pada MVP.

---

## Hosting

Cloudflare Pages Free.

---

## Repository

GitHub.

---

## Database

Supabase PostgreSQL.

---

## Authentication

Supabase Auth.

MVP menggunakan:

- Email
- Password

Public registration tidak digunakan.

---

# 6. AUTHENTICATION MODEL

Ada **dua jalur** pembuatan account:

### A. Admin-Created Account

Account dibuat / dikelola oleh Developer lewat Admin Panel. Langsung
berstatus `active`. Feature access default OFF, diaktifkan manual oleh
Developer.

### B. Self-Signup — Freemium Guest Mode (§73, §74)

User dapat mencoba Invoice/Packing List **tanpa login** (guest mode), dan
baru diminta membuat account di titik klik Download — bukan di awal.

> **Prinsip: "Show the value first, ask for account later."**

Account hasil self-signup otomatis mendapat feature `invoice` +
`packing_list` aktif (free tier), tapi berstatus `pending` sampai
Developer meng-klik **Activate** — selama itu PDF yang di-download tetap
berwatermark. Detail lengkap ada di §73 (Guest Mode) dan §74 (Account
Activation).

Flow login (returning user):

```text id="6u2k8p"
LOGIN
 ↓
Supabase Auth
 ↓
Authentication Success
 ↓
Check Account Status
 ↓
Check Feature Access
 ↓
Dashboard
```

Jika account locked:

```text id="8x1p5q"
Access Denied
Your account has been locked by the administrator.
```

---

# 7. USER ROLES

## Developer

Developer memiliki kontrol penuh terhadap:

- User
- Account status
- Feature access
- Application configuration

---

## Customer

Customer dapat menggunakan fitur yang telah diaktifkan untuk account-nya.

Customer tidak dapat:

- Mengubah role
- Mengaktifkan feature sendiri
- Membuka account yang dikunci
- Mengakses data user lain

---

# 8. ACCOUNT STATUS

Account memiliki status:

```text id="1s8d7p"
ACTIVE
PENDING
LOCKED
```

### ACTIVE

User dapat login dan menggunakan feature yang diizinkan. PDF di-download
tanpa watermark.

### PENDING (§74)

Status awal account hasil **self-signup** (guest mode, §73). User tetap
bisa login dan memakai feature yang sudah otomatis aktif (`invoice` +
`packing_list`) — termasuk menyimpan dokumen — tapi PDF yang di-download
**berwatermark** sampai Developer meng-klik **Activate** di Admin Panel.
Account admin-created TIDAK pernah berstatus `pending` — selalu langsung
`active`.

### LOCKED

User tidak dapat menggunakan aplikasi.

Account lock dikontrol Developer.

---

# 9. MODULAR FEATURE ACCESS

Account status dan feature access adalah dua sistem berbeda.

Contoh:

```text id="6x5t2z"
Account
ACTIVE

Feature:
Commercial Invoice   ON
Packing List          ON
Purchase Order       OFF
Shipping Rate         OFF
Duty & Tax            OFF
```

User dapat aktif tetapi hanya memiliki akses ke feature tertentu.

---

# 10. FEATURE SYSTEM

Database menggunakan sistem feature modular.

Tabel utama:

```text id="2j8k5m"
features
user_features
```

Tidak menggunakan banyak kolom seperti:

```text id="7a2f6c"
invoice_enabled
po_enabled
shipping_enabled
tax_enabled
```

karena pendekatan tersebut sulit dikembangkan.

---

# 11. FEATURES TABLE

Struktur:

```text id="p4y8x1"
id
feature_key
feature_name
description
active
created_at
```

Contoh:

```text id="k5w3s8"
invoice
packing_list
purchase_order
shipping_rate
duty_tax
proforma_invoice
quotation
certificate_of_origin
landed_cost
```

---

# 12. USER FEATURES TABLE

Struktur:

```text id="m8z2v7"
id
user_id
feature_id
enabled
created_at
updated_at
```

Contoh:

```text id="3q6h1k"
User A
invoice           true
packing_list      true
purchase_order    false
shipping_rate     false
duty_tax          false
```

---

# 13. DEVELOPER FEATURE CONTROL

Developer Dashboard menyediakan:

```text id="n3k7w2"
USER: PT ABC

ACCOUNT
● Active

FEATURE ACCESS

Commercial Invoice      ● ON
Packing List             ● ON
Purchase Order          ○ OFF
Shipping Rate            ○ OFF
Duty & Tax               ○ OFF

[ Save Changes ]
```

Feature yang belum aktif dapat ditampilkan sebagai locked.

---

# 14. FEATURE STATES

UI mengenal tiga kondisi:

### Enabled

```text id="4j9w2e"
● Available
```

### Disabled / Locked

```text id="6f3m8a"
🔒 Upgrade to Unlock
```

### Coming Soon

```text id="2d7v1k"
🚧 Coming Soon
```

---

# 15. FUTURE PLAN SYSTEM

MVP tidak memerlukan payment/subscription.

Namun database dipersiapkan untuk:

```text id="1h5n8z"
plans
plan_features
```

Contoh future plan:

### Free

```text id="f2j8n6"
Commercial Invoice ✓
Packing List ✓
Purchase Order ✕
Shipping Rate ✕
Duty & Tax ✕
```

### Business

```text id="q7m3x9"
Commercial Invoice ✓
Packing List ✓
Purchase Order ✓
Shipping Rate ✓
Duty & Tax ✕
```

### Pro

```text id="z8k4p2"
Commercial Invoice ✓
Packing List ✓
Purchase Order ✓
Shipping Rate ✓
Duty & Tax ✓
```

Payment system dibuat pada fase berikutnya.

---

# 16. FEATURE OVERRIDE

Developer dapat memberikan akses khusus.

Contoh:

```text id="v5q8n1"
User:
PT ABC

Plan:
Free

Special Access:
Purchase Order = ON
```

Kegunaan:

- Trial
- Beta tester
- Demo
- Complimentary access
- Customer khusus
- Promotion
- Reseller

---

# 17. CUSTOMER DASHBOARD

Menu:

```text id="g3x8v2"
Dashboard

DOCUMENTS
Commercial Invoice
Packing List
Purchase Order 🔒

TOOLS
Shipping Rate 🔒
Duty & Tax 🔒

MASTER DATA
Products
Customers
Suppliers

SETTINGS
Company
Account
```

Locked features tetap terlihat sebagai preview kemampuan aplikasi.

---

# 18. NEW COMMERCIAL INVOICE

Flow:

```text id="w7k3q1"
+ New Invoice
```

User memilih:

```text id="e5v8m2"
Shipment Type

○ EXPORT
○ IMPORT

Template

○ SIMPLE
○ COMPLETE

Invoice Number

○ AUTOMATIC
○ MANUAL
```

---

# 19. EXPORT / IMPORT

Field:

```text id="p4x9k7"
shipment_type
```

Values:

```text id="u8m3c5"
export
import
```

---

# 20. SIMPLE TEMPLATE

Tujuan:

> Membuat invoice dengan input minimum.

### Shipper

- Company Name
- Address
- Country

### Receiver

- Company Name
- Address
- Country

### Shipment

- Shipment Type
- Invoice Number
- Invoice Date
- Weight
- Dimensions
- Package
- Value
- Currency

### Items

- Description
- Quantity
- Unit
- Unit Price
- Amount

Semua field bersifat optional.

---

# 21. COMPLETE TEMPLATE

Complete Template menyediakan:

### Company

- Company Name
- PIC
- Email
- Phone
- Address
- City
- Country
- Postal Code
- Tax ID
- Registration Number

### Invoice

- Invoice Number
- Invoice Date
- PO Number
- Reference Number
- Payment Terms
- Incoterms
- Currency

### Shipment

- Mode of Transport
- Port of Loading
- Port of Discharge
- Final Destination
- Country of Origin
- Country of Destination
- AWB
- B/L
- Container Number
- Vessel / Flight
- Shipment Date

### Product

- Product
- SKU
- Description
- HS Code
- Country of Origin
- Quantity
- Unit
- Unit Price
- Amount
- Net Weight
- Gross Weight

---

# 22. NO FORCED DATA

Semua field pada Simple maupun Complete:

> **OPTIONAL**

Termasuk:

- Company Name
- PIC
- Email
- Phone
- Address
- Tax ID
- PO
- AWB
- B/L
- Container
- HS Code
- Country of Origin
- Customs Information

User tetap dapat membuat dokumen meskipun sebagian besar field kosong.

---

# 23. SOFT VALIDATION

Sistem menggunakan warning daripada blocking error.

Contoh:

```text id="k9f3x2"
⚠ Some recommended information is missing.

You can still generate this document.
```

Button:

```text id="m7x4p8"
[ Review ]
[ Generate PDF Anyway ]
```

---

# 24. EMPTY FIELD RULE

Field kosong tidak ditampilkan pada PDF jika tidak diperlukan.

Contoh:

Jika email kosong, PDF tidak menampilkan:

```text id="a2k8m5"
Email:
```

Field tersebut cukup dihilangkan.

---

# 25. INVOICE NUMBER

Automatic:

```text id="r7v3n9"
INV-{YEAR}-{SEQUENCE}
```

Contoh:

```text id="p2x5k8"
INV-2026-00001
INV-2026-00002
```

Manual:

```text id="c8m4z1"
SIH-EXP-2026-001
```

Duplicate number harus ditolak.

---

# 26. PACKING LIST NUMBER

Automatic:

```text id="q4n7v2"
PL-{YEAR}-{SEQUENCE}
```

Manual juga tersedia.

Duplicate harus ditolak.

---

# 27. PRODUCT MANAGEMENT

Field:

```text id="x9m2c6"
SKU
Product Name
Description
HS Code
Country of Origin
Unit
Default Price
Default Weight
Active
```

Product dapat digunakan kembali dalam invoice dan packing list.

---

# 28. CUSTOMER MANAGEMENT

Field:

```text id="z5k8q3"
Company Name
PIC
Email
Phone
Address
City
State
Postal Code
Country
Tax ID
```

---

# 29. SUPPLIER MANAGEMENT

Struktur serupa dengan Customer.

---

# 30. COMMERCIAL INVOICE STRUCTURE

```text id="n6p3x8"
Header
Shipper
Receiver
Shipment Information
Items
Subtotal
Charges
Grand Total
Customs Information
Notes
```

---

# 31. ITEM CALCULATION

Formula:

```text id="u4m8y2"
Amount = Quantity × Unit Price
```

Jika data tidak lengkap, sistem tidak boleh crash.

---

# 32. TOTAL CALCULATION

```text id="v7x2k9"
Subtotal
Freight
Insurance
Other Charges
Discount
Grand Total
```

Formula:

```text id="m3q8p1"
Grand Total =
Subtotal
+ Freight
+ Insurance
+ Other Charges
- Discount
```

---

# 33. CUSTOMS ADDITIONAL INFORMATION

User dapat menambahkan informasi customs secara fleksibel.

Sistem menyediakan:

> **Suggested Customs Fields**

Suggested fields berfungsi sebagai panduan dan tidak dianggap sebagai persyaratan customs universal.

---

# 34. SUGGESTED CUSTOMS FIELDS

### Shipment

- Country of Origin
- Country of Destination
- Port of Loading
- Port of Discharge
- Final Destination
- Mode of Transport

### Product

- HTS Code
- HS Code
- Product Description
- Material
- Brand
- Model Number
- Part Number
- Manufacturer
- Country of Origin
- Intended Use
- Product Condition

### Customs / Declaration

- Purpose
- Customs Value
- Declared Value
- FDA Registration
- License Number
- Certificate Number

### Handling

- Special Instruction
- Package Type
- Handling Instruction
- Storage Condition

### Other

- Reference Number
- Additional Information
- Other

---

# 35. CUSTOM FIELD

User dapat membuat Object sendiri.

Contoh:

```text id="w2k7p9"
Object:
Import Permit Number

Answer:
IP-2026-12345
```

---

# 36. CUSTOM FIELD TYPES

```text id="c5n8x2"
Text
Long Text
Number
Date
Dropdown
Yes / No
File
Multiple File
```

---

# 37. CUSTOM FIELD SCOPE

Custom field dapat diterapkan pada:

```text id="h3m9q7"
Invoice
Shipment
Product
Package
```

---

# 38. CUSTOM FIELD PDF CONTROL

Setiap field memiliki:

```text id="k8v2p5"
Display on PDF
○ YES
○ NO
```

Field kosong tidak ditampilkan.

---

# 39. TEMPORARY ATTACHMENTS

Attachment dapat digunakan untuk:

- Product Photo
- Certificate
- License
- Supporting Document
- Other

Supported image formats:

```text id="x7m4n2"
PNG
JPG
JPEG
WebP
```

---

# 40. ATTACHMENT STORAGE POLICY

MVP **tidak menggunakan Supabase Storage untuk shipment attachments**.

File:

```text id="q3v8k5"
User selects file
 ↓
Browser memory
 ↓
Preview
 ↓
Generate PDF
 ↓
Download
 ↓
Memory cleared
```

Tidak ada permanent file storage.

Konsekuensi:

> Attachment lama tidak tersedia ketika invoice dibuka kembali.

Permanent storage dapat menjadi fitur premium di masa depan.

---

# 41. PACKING LIST

Packing List dapat dibuat:

```text id="z8m4p1"
From Scratch
```

atau:

```text id="x5k9q2"
From Commercial Invoice
```

Jika dari Invoice:

```text id="f7v3n8"
Invoice
 ↓
Create Packing List
 ↓
Import Item Data
 ↓
Add Package Data
 ↓
Generate PDF
```

---

# 42. SIMPLE PACKING LIST

Field:

- Packing List Number
- Date
- Shipper
- Receiver
- Package
- Description
- Quantity
- Unit
- Weight
- Dimensions
- CBM

---

# 43. COMPLETE PACKING LIST

Field:

- Packing List Number
- Date
- Shipper
- Receiver
- Package Number
- SKU
- Description
- HS Code
- Quantity
- Unit
- Net Weight
- Gross Weight
- Length
- Width
- Height
- CBM
- Country of Origin
- Marks & Numbers
- Package Type

---

# 44. CBM

Untuk centimeter:

```text id="j6q2v8"
CBM =
Length × Width × Height / 1,000,000
```

---

# 45. DOCUMENT PREVIEW

Sebelum generate:

```text id="m8x3p5"
[ Preview Document ]
```

Preview harus mendekati hasil PDF.

---

# 46. PDF GENERATION

Flow:

```text id="v2n7k4"
Form
 ↓
Soft Validation
 ↓
Preview
 ↓
Generate PDF
 ↓
Download
```

PDF tidak disimpan permanen pada MVP.

---

# 47. DOCUMENT HISTORY

User dapat melihat:

```text id="q8m5x2"
Invoices
Packing Lists
```

Actions:

```text id="n4v7p9"
View
Edit
Duplicate
Generate PDF
Delete
```

---

# 48. DUPLICATE DOCUMENT

Duplicate menghasilkan dokumen baru.

Data dapat di-copy dari dokumen lama tetapi:

- ID baru
- Document number baru
- Timestamp baru

---

# 49. DATABASE

Core tables:

```text id="y7p3m8"
profiles
features
user_features
companies
customers
suppliers
products
invoices
invoice_items
packing_lists
packing_list_items
custom_fields
custom_field_values
```

Future:

```text id="f4n8q2"
plans
plan_features
subscriptions
payments
```

---

# 50. PROFILES

```text id="k2x7m4"
id
email
full_name
role
status
created_at
updated_at
```

Role:

```text id="p8v3n5"
developer
customer
```

Status:

```text id="z4m7q1"
active
locked
```

---

# 51. COMPANIES

```text id="x8n2p5"
id
user_id
company_name
pic
email
phone
address
city
country
postal_code
tax_id
registration_number
created_at
updated_at
```

---

# 52. PRODUCTS

```text id="m5q8v3"
id
user_id
sku
name
description
hs_code
country_of_origin
unit
default_price
default_weight
active
created_at
updated_at
```

---

# 53. INVOICES

```text id="p7x4n9"
id
user_id
shipment_type
invoice_number
invoice_number_mode
invoice_date
customer_id
currency
payment_terms
incoterms
po_number
reference_number
port_of_loading
port_of_discharge
final_destination
country_of_origin
country_of_destination
awb_number
bl_number
container_number
vessel_flight
shipment_date
subtotal
freight
insurance
other_charges
discount
grand_total
template_type
status
created_at
updated_at
```

---

# 54. INVOICE ITEMS

```text id="v3m8q2"
id
invoice_id
product_id
description
sku
hs_code
country_of_origin
quantity
unit
unit_price
amount
net_weight
gross_weight
created_at
```

---

# 55. PACKING LISTS

```text id="n9x5p4"
id
user_id
invoice_id
packing_list_number
packing_list_number_mode
packing_list_date
template_type
status
created_at
updated_at
```

---

# 56. PACKING LIST ITEMS

```text id="q6m2v8"
id
packing_list_id
invoice_item_id
package_number
description
quantity
unit
net_weight
gross_weight
length
width
height
cbm
package_type
marks_numbers
created_at
```

---

# 57. CUSTOM FIELDS

```text id="x4p8n3"
id
user_id
field_name
field_type
scope
options
required
display_on_pdf
created_at
updated_at
```

Values:

```text id="m7q2v5"
id
field_id
invoice_id
product_id
packing_list_id
value
created_at
updated_at
```

---

# 58. RLS

Supabase Row Level Security wajib digunakan.

Customer hanya dapat:

```text id="p3n8x6"
SELECT own data
INSERT own data
UPDATE own data
DELETE own data
```

User A tidak dapat membaca:

```text id="v5m2q9"
User B invoices
User B customers
User B products
User B packing lists
```

Developer memiliki access sesuai role.

---

# 59. SECURITY

Tidak boleh menaruh:

- Supabase service role key
- Secret key
- Developer credentials

di frontend.

Frontend menggunakan public client configuration dengan RLS sebagai security boundary.

Feature lock tidak boleh hanya berupa:

```text id="n7x4m2"
Hide button with JavaScript
```

Authorization harus tetap diterapkan pada database/API layer.

---

# 60. FREE-TIER STRATEGY

MVP menggunakan:

```text id="q8p3v6"
GitHub Free
Cloudflare Pages Free
Supabase Free
```

Tidak menggunakan:

```text id="m5n7x2"
Firebase
Cloudflare D1
VPS
Paid PDF API
Paid storage
```

PDF dibuat client-side.

Attachment tidak disimpan permanen.

---

# 61. FUTURE MONETIZATION

Feature dapat menjadi produk tambahan.

Contoh:

```text id="v4q8m2"
CORE
Commercial Invoice
Packing List
```

Additional:

```text id="n6x3p7"
Purchase Order
Shipping Rate
Duty & Tax
Proforma Invoice
Quotation
```

Premium:

```text id="m8v2q5"
Saved Attachments
Advanced Templates
Team Members
Cloud Document Storage
API Access
```

---

# 62. PURCHASE ORDER

**Status: Built** (roadmap Core/Sales #4).

Beda dari Proforma Invoice (§76, pakai `doc_type` di tabel `invoices`
yang sama), Purchase Order pakai tabel sendiri (`purchase_orders` +
`purchase_order_items`) karena field-nya cukup beda dari Commercial
Invoice — party-nya "Supplier" (bukan Shipper/Receiver), tidak ada
freight/insurance/incoterms.

Flow:

```text id="x5p9n3"
Supplier + Deliver To (opsional)
 ↓
Items (description, SKU, qty, unit, unit price)
 ↓
Terms (payment, delivery, expected delivery date)
 ↓
Purchase Order tersimpan (nomor otomatis PO-{YEAR}-{SEQ})
 ↓
PDF
```

Feature access:

```text id="q7m4v8"
purchase_order
```

**Catatan akses:** beda dari `invoice`/`packing_list`, feature ini
**tidak** otomatis aktif untuk akun self-signup (§73) — Developer perlu
enable manual per customer, sama seperti akun admin-created. Tidak ada
guest mode untuk halaman ini.

Bisa dibuat dari nol, atau dari **Sales Order** (§75 — Document Chain)
lewat "Load from Sales Order" (items saja yang ikut ter-copy, bukan
party info — SO bukan pembelian, hubungan Supplier di PO tidak otomatis
sama dengan Customer di SO).

---

# 63. SHIPPING RATE CHECKER

Future feature.

User memasukkan:

```text id="n3x8p5"
Origin
Destination
Weight
Dimensions
Package
Shipping Mode
```

Sistem kemudian dapat mengintegrasikan shipping/carrier rate provider.

Feature access:

```text id="v6m2q9"
shipping_rate
```

API provider dan pricing model ditentukan pada fase pengembangan fitur.

---

# 64. DUTY & TAX CALCULATOR

Future feature.

Input dapat meliputi:

```text id="p8x3m7"
Country
HS Code
Product Value
Shipping Cost
Insurance
Currency
```

Output:

```text id="q4n9v2"
Estimated Duty
Estimated Tax
Estimated Total Import Cost
```

Hasil harus diberi disclaimer bahwa estimasi bukan keputusan resmi customs.

Feature access:

```text id="m5p8x3"
duty_tax
```

---

# 65. DOCUMENT ROADMAP

Prioritas roadmap dokumen (lihat §75 untuk bagaimana dokumen-dokumen ini
saling terhubung sebagai satu rantai):

## Core

```text id="x7q2n5-core"
1. Commercial Invoice     -- Built
2. Packing List           -- Built
3. Proforma Invoice       -- Built (§76, doc_type di tabel invoices)
```

## Sales / Order

```text id="x7q2n5-sales"
4. Purchase Order         -- Built (§62)
5. Sales Order            -- Built (§77)
6. Delivery Note          -- Built (§79)
```

## Shipping

```text id="x7q2n5-ship"
7. Shipping Instruction   -- Built (§78)
8. Delivery Order         -- Belakangan (belum dibangun, prioritas rendah)
```

## Eksplisit DI LUAR SCOPE

**Shipping Label** — sengaja TIDAK dibangun dan tidak direncanakan.
Shipping Label (label pengiriman fisik yang ditempel di paket, biasanya
berisi barcode/tracking number carrier) adalah tanggung jawab perusahaan
kurir/ekspedisi (DHL, FedEx, JNE, dll) yang punya sistem dan format
label sendiri — bukan dokumen yang dibuat eksportir/importir seperti
dokumen-dokumen lain di atas. Feature architecture (§9-16) tetap
modular dan bisa menambah dokumen baru kapan saja, tapi Shipping Label
secara sadar dikeluarkan dari roadmap ini.

Kandidat lain yang belum masuk prioritas (boleh ditambah nanti tanpa
mengubah authentication system, lihat §71):

```text id="x7q2n5-later"
Quotation
Certificate of Origin
Commercial Contract
```

---

# 66. USER EXPERIENCE

User baru:

```text id="n8v3p5"
Login
 ↓
Dashboard
 ↓
New Invoice
 ↓
Export / Import
 ↓
Simple
 ↓
Input basic information
 ↓
Generate PDF
```

Advanced user:

```text id="q5m7x2"
Login
 ↓
Complete Template
 ↓
Customs Fields
 ↓
Additional Information
 ↓
Preview
 ↓
PDF
```

---

# 67. DEVELOPMENT PHASE

## PHASE 1 — FOUNDATION

- GitHub repository
- Cloudflare Pages
- Supabase project
- Database schema
- RLS
- Basic frontend structure

---

## PHASE 2 — AUTH & ACCESS

- Supabase Auth
- Login
- Logout
- Session
- Developer role
- Customer role
- Active / Locked
- Features
- User feature access

---

## PHASE 3 — MASTER DATA

- Company
- Customers
- Suppliers
- Products

---

## PHASE 4 — COMMERCIAL INVOICE

- Export / Import
- Simple / Complete
- Automatic number
- Manual number
- Items
- Calculation
- Save
- Edit
- History

---

## PHASE 5 — PDF

- Preview
- PDF generation
- PDF download
- Templates

---

## PHASE 6 — PACKING LIST

- Simple
- Complete
- Automatic / Manual number
- Generate from Invoice
- PDF

---

## PHASE 7 — CUSTOMS

- Suggested Customs Fields
- Custom Fields
- File attachment
- Temporary browser storage
- PDF integration

---

## PHASE 8 — FUTURE MONETIZATION

- Plans
- Feature packages
- Subscription
- Payment
- Usage limits
- Premium features

---

## PHASE 9 — FREEMIUM ONBOARDING (GUEST MODE) — §73

- Guest mode di `invoice.html` & `packinglist.html`
- PDF preview watermark untuk guest (client-side)
- Modal signup ringan di titik klik Download
- Draft otomatis tersimpan ke account baru setelah signup/login
- Landing page (`index.html`) diubah jadi halaman pilih jenis dokumen,
  `login.html` dipisah jadi halaman tersendiri

---

## PHASE 10 — ACCOUNT ACTIVATION (PENDING STATUS) — §74

- Status `pending` di antara `active` dan `locked`
- Self-signup mulai dari `pending`, bukan langsung `active`
- PDF watermark selama pending, hilang setelah Developer klik Activate
- `is_account_usable()` — insert dokumen tetap boleh selama tidak `locked`

---

## PHASE 11 — PROFORMA INVOICE — §76

- Kolom `doc_type` di tabel `invoices` (`commercial` / `proforma`)
- Prefix nomor & judul PDF berbeda per `doc_type`
- Tombol Convert to Commercial Invoice

---

## PHASE 12 — PURCHASE ORDER & SALES ORDER — §62, §77

- Tabel `purchase_orders` + `purchase_order_items`
- Tabel `sales_orders` + `sales_order_items`
- Feature access manual per customer (bukan free tier)

---

## PHASE 13 — SHIPPING INSTRUCTION & DELIVERY NOTE — §78, §79

- Tabel `shipping_instructions` + `shipping_instruction_items`
- Tabel `delivery_notes` + `delivery_note_items`
- Dokumen non-komersial (tanpa harga)

---

## PHASE 14 — DOCUMENT CHAIN — §75

- Kolom `source_<dokumen>_id` di tiap tabel dokumen (nullable)
- "Load from &lt;dokumen sumber&gt;" antar halaman create
- Komponen "Document Trail" (⬆ upstream / ⬇ downstream) di modal History

---

# 68. MVP SUCCESS CRITERIA

MVP dianggap berhasil jika:

1. Developer dapat membuat account.
2. Developer dapat lock/unlock account.
3. Developer dapat mengaktifkan/menonaktifkan feature.
4. Customer dapat login.
5. Locked customer tidak dapat menggunakan aplikasi.
6. Customer hanya dapat mengakses feature yang diaktifkan.
7. Customer dapat membuat company.
8. Customer dapat membuat customer.
9. Customer dapat membuat supplier.
10. Customer dapat membuat product.
11. Customer dapat memilih Export / Import.
12. Customer dapat memilih Simple / Complete.
13. Customer dapat memilih Automatic / Manual Number.
14. Commercial Invoice dapat dibuat.
15. Commercial Invoice dapat disimpan.
16. Commercial Invoice dapat diedit.
17. Commercial Invoice dapat diduplicate.
18. Invoice total dapat dihitung.
19. Packing List dapat dibuat.
20. Packing List dapat dibuat dari Invoice.
21. PDF dapat dipreview.
22. PDF dapat digenerate.
23. PDF dapat didownload.
24. Suggested Customs Fields tersedia.
25. Custom Fields tersedia.
26. Attachment dapat digunakan sementara.
27. Attachment tidak disimpan permanen.
28. Data user terisolasi menggunakan RLS.
29. Aplikasi berjalan pada Cloudflare Pages.
30. Database berjalan pada Supabase Free.
31. Tidak membutuhkan Firebase.
32. Tidak membutuhkan D1.
33. Tidak membutuhkan React.
34. Arsitektur siap menerima fitur premium di masa depan.
35. Guest dapat membuat Invoice/Packing List tanpa login.
36. Guest diminta membuat account hanya pada saat klik Download, bukan di awal form.
37. Draft guest otomatis tersimpan ke account baru setelah signup, tanpa data hilang.
38. Self-signup account otomatis mendapat feature `invoice` + `packing_list` aktif, status awal `pending`.
39. Admin-created account tetap default feature OFF dan status `active`, tidak terpengaruh perubahan self-signup.
40. Account `pending` tetap bisa login, isi form, dan simpan dokumen — hanya PDF yang berwatermark.
41. Developer dapat meng-klik Activate untuk mengubah `pending` menjadi `active`, menghilangkan watermark.
42. Proforma Invoice dapat dibuat dan di-convert menjadi Commercial Invoice.
43. Purchase Order dan Sales Order dapat dibuat, disimpan, dan menghasilkan PDF.
44. Shipping Instruction dan Delivery Note dapat dibuat, disimpan, dan menghasilkan PDF.
45. Dokumen di sepanjang rantai (PO→SO→Invoice→Packing List→SI→DN) dapat dibuat dengan "Load from" dokumen sebelumnya, tanpa mengetik ulang data yang sama.

---

# 69. PRODUCT PHILOSOPHY

Invoice Shipping Generator harus mengikuti prinsip:

> **No unnecessary complexity.**

User tidak boleh dipaksa memahami semua istilah customs untuk membuat dokumen sederhana.

Dan:

> **No unnecessary restrictions.**

User berpengalaman tetap dapat memasukkan informasi khusus melalui Suggested Customs Fields dan Custom Fields.

Dan:

> **Modular from day one.**

Feature baru dapat ditambahkan dan dijual tanpa membongkar sistem authentication dan database utama.

---

# 70. FINAL ARCHITECTURE

```text id="r5n8x2"
                    INVOICE SHIPPING GENERATOR
                              │
                              ▼
                    ┌───────────────────┐
                    │ Cloudflare Pages  │
                    │ HTML/CSS/JS       │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Supabase Auth     │
                    └─────────┬─────────┘
                              │
                     Account Status
                   Active / Pending / Locked
                              │
                              ▼
                    ┌───────────────────┐
                    │ Feature Access    │
                    └─────────┬─────────┘
                              │
          ┌─────────┬─────────┬─────────┬─────────┬─────────┐
          │         │         │         │         │         │
       Invoice   Packing   Purchase  Sales     Shipping   Delivery
       (+Proforma) List     Order    Order   Instruction    Note
                              │
                    Future: Shipping Rate, Duty/Tax
                              │
                              ▼
                    ┌───────────────────┐
                    │ Supabase Database │
                    │ PostgreSQL + RLS  │
                    └───────────────────┘
                              │
                              ▼
                     Browser PDF Engine
                              │
                              ▼
                           DOWNLOAD
```

---

# 71. CORE STRATEGY

MVP awal (sudah lewat — lihat §68 kriteria sukses) tetap kecil:

```text id="w8m3q5"
AUTH
+
INVOICE
+
PACKING LIST
+
PDF
```

Roadmap dokumen (§65) sudah berkembang lebih jauh dari MVP awal — lihat
status "Built" per dokumen di §65, §76-79. Sisa fitur yang memang masih
future (belum ada rencana build konkret):

```text id="x2p7n9"
SHIPPING RATE CHECKER
+
DUTY & TAX CALCULATOR
+
OTHER PREMIUM FEATURES (§61)
```

Dengan demikian **fitur belum dibuat ≠ struktur belum disiapkan**.
Fitur dapat ditambahkan kemudian tanpa harus melakukan redesign besar
terhadap account system — terbukti dari 5 dokumen baru (§76-79) yang
ditambahkan tanpa mengubah authentication/RLS model inti.

---

# 72. PRODUCT TAGLINE

### Primary

> **Create Shipping Documents, Simply.**

### Alternative

> **Commercial Invoice & Shipping Documents Made Simple.**

### Positioning

> **One simple tool for your shipping documentation.**

---

# 73. FREEMIUM ONBOARDING (GUEST MODE)

## Prinsip

> **Show the value first, ask for account later.**

Target user CargoDoc adalah orang yang ingin cepat membuat dokumen
pengiriman. Friksi di awal (login/signup, form panjang) harus seminimal
mungkin. Signup baru diminta di titik user sudah mendapat value — yaitu
saat klik **Download**, bukan sebelum mulai isi form.

## Flow

```text id="73-flow"
Landing page (index.html — pilih jenis dokumen, TANPA login)
 ↓
Isi form (Invoice atau Packing List)
 ↓
Klik "Preview & Download PDF"
 ↓
PDF watermark digenerate client-side (belum ke server)
 ↓
Modal muncul: "Your document is ready — create a free account
              to save & download the clean version"
 ↓
Signup (email + password) ATAU Sign in kalau sudah punya akun
 ↓
Draft (masih di memory browser) otomatis dikirim ke Supabase
 ↓
Dokumen tersimpan (RLS aktif, user_id = auth.uid())
 ↓
Account baru berstatus PENDING (§74) — PDF final TETAP watermark
sampai Developer klik Activate
```

## Guest Draft — Prinsip Keamanan

Draft dokumen milik guest hanya boleh hidup di memori browser, **tidak
pernah dianggap sumber otoritas**. Yang menentukan hak akses selalu
Supabase Auth + RLS, bukan data di sisi client. Dilarang keras pola
seperti `localStorage.role = "admin"` — user bisa mengubahnya sendiri
lewat DevTools. Begitu user signup, draft **wajib divalidasi ulang lewat
RLS** saat disimpan ke database.

## Membedakan Self-Signup vs Admin-Created

Edge Function `admin-create-user` menandai user yang ia buat dengan
`app_metadata: { created_by: 'admin' }`. Trigger `handle_new_user`
mengecek metadata ini:

| Jalur                          | Status awal | Default Feature Access              |
|---------------------------------|-------------|---------------------------------------|
| Self-signup (guest mode)        | `pending`   | `invoice` + `packing_list` = ON       |
| Admin-created (Edge Function)   | `active`    | Semua OFF (Developer enable manual)   |

## Guest Mode Berlaku Untuk

- Commercial Invoice (`invoice.html`)
- Packing List (`packinglist.html`)

Fitur lain (Purchase Order, Sales Order, Delivery Note, Shipping
Instruction) **tidak** guest mode — semuanya butuh login + feature yang
di-enable Developer secara manual per customer (bukan bagian free tier).
Master Data, History, dan Admin Panel juga tetap butuh login.

## Batasan MVP

- Free tier (hasil self-signup): unlimited dokumen untuk MVP.
- Verifikasi email tidak diwajibkan (prioritas minim friksi). Dapat
  diaktifkan lewat pengaturan Supabase Auth kapan saja tanpa ubah kode.

---

# 74. ACCOUNT ACTIVATION (PENDING STATUS)

## Kenapa Ada

Guest mode (§73) bikin siapa saja bisa langsung pakai `invoice` +
`packing_list` tanpa admin approve dulu — bagus untuk minim friksi,
tapi berarti Developer butuh cara untuk tetap memverifikasi
pembayaran/kelayakan account baru **sebelum** user dapat PDF final yang
bersih.

## Flow

```text id="74-flow"
Self-signup selesai (§73) -> status = PENDING
 ↓
User tetap bisa: login, isi form, save dokumen (draft maupun final)
 ↓
User klik Download -> PDF TETAP berwatermark (selama masih pending)
 ↓
User bayar / hubungi admin di luar aplikasi
 ↓
Developer cek pembayaran, buka Admin Panel
 ↓
Developer klik tombol "Activate" pada baris user itu -> status = ACTIVE
 ↓
Download berikutnya -> PDF bersih, tanpa watermark
```

## Yang TIDAK Diblokir Selama Pending

Prinsip "no unnecessary restrictions" (§69) tetap berlaku — status
`pending` **hanya** memengaruhi watermark PDF, bukan kemampuan pakai
aplikasi:

- Boleh login
- Boleh isi & simpan dokumen (draft maupun final) ke database
- Boleh edit/duplicate/delete dokumen sendiri
- Boleh lihat History

Satu-satunya yang diblokir: PDF final tanpa watermark.

## Yang Diblokir Kalau LOCKED (beda dari PENDING)

`locked` (§8) tetap berlaku seperti sebelumnya — user tidak bisa
menggunakan aplikasi sama sekali, termasuk menyimpan dokumen baru.
`is_account_usable()` (dipakai RLS insert) cuma menolak status
`locked`, bukan mensyaratkan `active` secara eksak — supaya `pending`
tetap bisa menyimpan data.

---

# 75. DOCUMENT CHAIN (LINKING)

## Prinsip

User input data sekali, dokumen berikutnya di rantai bisa **"Load from
&lt;dokumen sumber&gt;"** — otomatis isi party info & items, alih-alih
ketik ulang dari nol.

## Rantai Dokumen

```text id="75-chain"
Purchase Order (§62)
   │ items only
   ▼
Sales Order (§77)
   │ Customer -> Receiver+BillTo, Ship To -> Ship To, items
   ▼
Commercial Invoice (§18) / Proforma Invoice (§76)
   │ Shipper/Receiver, items -> packages
   ▼
Packing List (§41)
   │ Shipper -> Shipper, Receiver -> Consignee, packages -> cargo
   ▼
Shipping Instruction (§78)
   │ Shipper -> From, Consignee -> Deliver To, cargo -> items
   ▼
Delivery Note (§79)
```

Tiap hop cuma mem-bawa data yang **masuk akal secara bisnis** — kalau
hubungannya tidak jelas (misalnya PO ke SO: barang yang dibeli belum
tentu dijual ke customer yang sama), cuma items yang ikut ter-copy,
party info dikosongkan supaya user isi manual (bukan ditebak salah).

## Implementasi

Tiap tabel dokumen (kecuali Purchase Order, yang jadi titik awal rantai)
punya kolom `source_<dokumen_sebelumnya>_id`, nullable, `on delete set
null` — dokumen tetap bisa dibuat dari nol tanpa sumber. Ditampilkan di
UI lewat komponen "Document Trail" pada modal View di setiap halaman
History: panah ⬆ ke dokumen sumber, panah ⬇ ke dokumen turunan (1 hop
tiap arah, bukan breadcrumb penuh).

---

# 76. PROFORMA INVOICE

**Status: Built** (roadmap Core #3).

Proforma Invoice pakai tabel `invoices` yang sama dengan Commercial
Invoice (§18) — field-nya ~95% identik — dibedakan lewat kolom
`doc_type` (`'commercial'` / `'proforma'`), bukan tabel/halaman
terpisah. Bedanya cuma:

- Judul PDF: "PROFORMA INVOICE" vs "COMMERCIAL INVOICE"
- Prefix nomor: `PI-{YEAR}-{SEQ}` vs `INV-{YEAR}-{SEQ}`
- Field tambahan: `valid_until` (masa berlaku quotation, khusus proforma)
- Tombol **Convert to Commercial Invoice** (mode edit, khusus dokumen
  proforma) — mengubah `doc_type` jadi `commercial` tanpa bikin
  dokumen baru, nomor invoice tetap sama (bukan re-generate PI->INV)

Tetap tercover feature `invoice` yang sama — tidak perlu toggle admin
baru, dan ikut guest mode (§73) karena satu halaman (`invoice.html`)
dengan Commercial Invoice.

---

# 77. SALES ORDER

**Status: Built** (roadmap Sales/Order #5).

Kebalikan dari Purchase Order (§62): PO = beli dari Supplier, SO = jual
ke Customer. Field & pola RLS 1:1 sama dengan Purchase Order, cuma
"Supplier" → **Customer**, dan "Deliver To" → **Ship To**.

Flow:

```text id="77-flow"
Customer + Ship To (opsional)
 ↓
Items (description, SKU, qty, unit, unit price)
 ↓
Terms (payment, delivery, reference PO number dari customer)
 ↓
Sales Order tersimpan (nomor otomatis SO-{YEAR}-{SEQ})
 ↓
PDF
```

Feature access: `sales_order` — sama seperti Purchase Order, **tidak**
otomatis aktif untuk self-signup, tidak ada guest mode.

Bisa dibuat dari Purchase Order (items saja, §75), dan jadi sumber untuk
Commercial Invoice (Customer → Receiver+BillTo, Ship To → Ship To,
items).

---

# 78. SHIPPING INSTRUCTION

**Status: Built** (roadmap Shipping #7).

Instruksi dari Shipper ke Forwarder/Carrier tentang bagaimana sebuah
shipment harus diproses & didokumentasikan — dipakai carrier untuk
menerbitkan Bill of Lading. **Bukan dokumen komersial** — tidak
menampilkan harga, cuma detail muatan & routing.

Field utama:

```text id="78-fields"
Booking & Carrier: booking number, carrier, vessel/voyage,
                    mode of transport, shipment mode (FCL/LCL/Air),
                    container type & count
Routing: port of loading, port of discharge,
         place of delivery, final destination
Terms: freight terms (Prepaid/Collect), incoterms,
       B/L type, jumlah original B/L
Parties: Shipper, Consignee, Notify Party (opsional)
Cargo items: description, HS code, jumlah & jenis package,
             qty, gross/net weight, CBM
```

Feature access: `shipping_instruction` — tidak ada guest mode.

Dibuat dari Packing List (Shipper → Shipper, Receiver → Consignee,
packages → cargo items, §75), dan jadi sumber untuk Delivery Note
(Shipper → From, Consignee → Deliver To).

---

# 79. DELIVERY NOTE

**Status: Built** (roadmap Sales/Order #6).

Bukti serah-terima barang secara fisik — dibawa bersama barang saat
dikirim, ditandatangani penerima sebagai bukti barang sudah diterima.
Sama seperti Shipping Instruction, **bukan dokumen komersial** — tidak
menampilkan harga, cuma deskripsi & jumlah barang.

Field utama:

```text id="79-fields"
Delivery: driver name, vehicle number, vehicle type
From (pengirim/gudang): snapshot pola sama dengan Shipper di dokumen lain
Deliver To (penerima): snapshot
Bukti terima (opsional, diisi setelah barang diterima):
  received by, received date
Items: description, SKU, package count & type, qty, unit
```

Feature access: `delivery_note` — tidak ada guest mode.

Titik akhir rantai dokumen (§75) — dibuat dari Shipping Instruction.