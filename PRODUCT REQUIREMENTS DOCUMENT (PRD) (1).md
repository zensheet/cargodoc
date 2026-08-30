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

- Commercial Invoice
- Packing List
- Purchase Order
- Proforma Invoice
- Quotation
- Certificate of Origin

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

### A. Admin-Created Account (existing)

Account dibuat / dikelola oleh Developer lewat Admin Panel. Tidak melalui
public sign-up. Feature access untuk jalur ini **default OFF**, diaktifkan
manual oleh Developer.

### B. Self-Signup — Freemium Guest Mode (lihat §73)

User dapat mencoba aplikasi **tanpa login** (guest mode), dan baru diminta
membuat account **di titik klik Download** — bukan di awal.

> **Prinsip: "Show the value first, ask for account later."**

Account hasil self-signup otomatis mendapat feature `invoice` +
`packing_list` aktif (free tier), dibedakan dari account admin-created
lewat metadata `created_by` pada `auth.users`. Detail lengkap flow, data
guest, dan aturan keamanannya ada di **§73**.

Flow login (admin-created account / returning user):

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

Flow guest baru (ringkas — detail lengkap di §73):

```text id="6u2k8p-guest"
GUEST (tanpa login)
 ↓
Pilih dokumen & isi form
 ↓
Preview PDF (watermark)
 ↓
Klik Download
 ↓
Signup singkat (email + password)
 ↓
Draft otomatis tersimpan ke account baru
 ↓
PDF asli (tanpa watermark) — download
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
LOCKED
```

### ACTIVE

User dapat login dan menggunakan feature yang diizinkan.

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

Future feature.

Flow:

```text id="x5p9n3"
Supplier
 ↓
Products
 ↓
Quantity
 ↓
Price
 ↓
Terms
 ↓
Purchase Order
 ↓
PDF
```

Feature access:

```text id="q7m4v8"
purchase_order
```

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

# 65. FUTURE DOCUMENTS

Feature architecture harus memungkinkan penambahan:

```text id="x7q2n5"
Proforma Invoice
Quotation
Certificate of Origin
Delivery Note
Purchase Order
Commercial Contract
```

tanpa mengubah authentication system.

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

## PHASE 9 — FREEMIUM ONBOARDING (GUEST MODE)

- Guest mode di `invoice.html` & `packinglist.html` (bisa diakses tanpa login)
- PDF preview watermark untuk guest (client-side, tidak disimpan ke DB)
- Modal signup ringan di titik klik Download
- Draft otomatis tersimpan ke account baru setelah signup/login sukses
- Tandai account admin-created via `app_metadata` di Edge Function
  `admin-create-user`
- Update trigger `handle_new_user`: auto-enable `invoice` + `packing_list`
  khusus untuk self-signup, tetap OFF untuk admin-created (lihat §73)
- Landing page (`index.html`) diubah dari form login menjadi halaman pilih
  jenis dokumen

---

## PHASE 10 — ACCOUNT ACTIVATION (MANUAL PAYMENT GATE)

- Status akun baru: `pending`, di antara `active` dan `locked`
- Self-signup (guest -> create account, lihat §73) sekarang mulai dari
  `pending`, bukan langsung `active` — admin-created tetap langsung
  `active` seperti sebelumnya
- Akun `pending` tetap bisa isi, save, dan edit Invoice/Packing List
  (feature `invoice`/`packing_list` tetap auto-ON seperti §73) — cuma PDF
  hasil downloadnya tetap watermark
- PDF final tanpa watermark HANYA untuk akun berstatus `active`
- Banner "pending activation" ditampilkan di dashboard (`app.html`) dan di
  halaman `invoice.html`/`packinglist.html` untuk customer yang sudah
  login tapi masih `pending`
- Admin Panel (`admin.html`): tombol **Activate** pada akun `pending`
  (di-klik developer setelah verifikasi pembayaran/kontak manual) — set
  status jadi `active`; tombol **Lock** tetap tersedia untuk menolak
- Flow yang didukung:
  ```
  Guest -> isi Invoice/Packing List -> preview PDF watermark
  -> Create Account -> status = PENDING
  -> user bayar / hubungi admin -> admin cek pembayaran
  -> admin klik "Activate" -> status = ACTIVE
  -> PDF final tanpa watermark
  ```

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
36. Guest dapat melihat preview PDF (watermark) tanpa login.
37. Guest diminta membuat account hanya pada saat klik Download, bukan di awal form.
38. Draft guest otomatis tersimpan ke account baru setelah signup, tanpa data hilang.
39. Self-signup account otomatis mendapat feature `invoice` + `packing_list` aktif.
40. Admin-created account tetap default feature OFF (tidak terpengaruh perubahan self-signup).
41. Self-signup account berstatus `pending` sampai admin meng-aktivasi, bukan langsung `active`.
42. Akun `pending` tetap dapat membuat & menyimpan Invoice/Packing List, tapi PDF-nya tetap watermark.
43. Admin dapat meng-klik "Activate" pada akun `pending` untuk mengubah statusnya jadi `active`.
44. Setelah diaktivasi, PDF yang di-download (baik baru maupun dari history) tidak lagi watermark.

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
                       Active / Locked
                              │
                              ▼
                    ┌───────────────────┐
                    │ Feature Access    │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       Invoice             Packing List       Future Features
          │                   │                   │
          │                   │          ┌────────┼─────────┐
          │                   │          │        │         │
          │                   │         PO    Shipping   Duty/Tax
          │                   │
          └───────────────────┼───────────────────┘
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

MVP harus tetap kecil:

```text id="w8m3q5"
AUTH
+
INVOICE
+
PACKING LIST
+
PDF
```

Tetapi database dan access-control harus disiapkan untuk:

```text id="x2p7n9"
PO
+
SHIPPING RATE
+
DUTY & TAX
+
PROFORMA
+
QUOTATION
+
OTHER PREMIUM FEATURES
```

Dengan demikian **fitur belum dibuat ≠ struktur belum disiapkan**.

Fitur dapat ditambahkan kemudian tanpa harus melakukan redesign besar terhadap account system.

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
Landing page
 ↓
Pilih jenis dokumen (Invoice / Packing List) — TANPA login
 ↓
Isi form
 ↓
Preview PDF (watermark "DRAFT — Sign up to download")
 ↓
Klik "Download PDF"
 ↓
┌─────────────────────────────────────┐
│ Your document is ready.              │
│                                       │
│ Create a free CargoDoc account to    │
│ save and download your document.     │
│                                       │
│ Email    [__________]                │
│ Password [__________]                │
│ [ Create Free Account ]              │
│                                       │
│ Already have an account? Sign in.    │
└─────────────────────────────────────┘
 ↓
Signup / Login sukses
 ↓
Draft (masih di memory browser) otomatis dikirim ke Supabase
 ↓
Dokumen tersimpan ke account baru (RLS aktif, user_id = auth.uid())
 ↓
PDF asli (tanpa watermark) — auto-download
```

## Guest Draft — Prinsip Keamanan

Draft dokumen milik guest **hanya boleh hidup di memori browser (state
JavaScript / localStorage khusus draft), tidak pernah dianggap sumber
otoritas**. Yang menentukan hak akses selalu Supabase Auth + RLS, bukan
data yang ada di sisi client.

Dilarang keras pola seperti:

```text id="73-antipattern"
localStorage.role = "admin"
localStorage.invoice_enabled = true
```

karena user bisa mengubahnya sendiri lewat DevTools. Draft guest boleh
disimpan sementara sebagai data mentah dokumen (bukan status login, role,
atau permission), tapi begitu user signup, data itu **wajib divalidasi
ulang lewat RLS** saat disimpan ke database — bukan dipercaya mentah-mentah
dari client.

```text id="73-flow-security"
Guest draft (browser memory)
 ↓
Signup / Login
 ↓
Kirim draft ke Supabase (insert)
 ↓
RLS memvalidasi: user_id = auth.uid()?
 ↓
Tersimpan ke DB — HANYA kalau valid
```

## Membedakan Self-Signup vs Admin-Created

Trigger `handle_new_user` (lihat §6, §9) perlu tahu apakah account baru
ini hasil self-signup (guest mode) atau dibuat manual oleh Developer lewat
Admin Panel — karena default feature access-nya beda:

| Jalur                          | Default Feature Access              |
|---------------------------------|---------------------------------------|
| Self-signup (guest mode)        | `invoice` + `packing_list` = ON       |
| Admin-created (Edge Function)   | Semua OFF (Developer enable manual)   |

Cara membedakan: Edge Function `admin-create-user` menandai user yang ia
buat dengan `app_metadata: { created_by: 'admin' }`. Trigger
`handle_new_user` mengecek metadata ini — kalau **tidak ada**, berarti
self-signup asli, maka feature `invoice` dan `packing_list` otomatis
di-set `enabled = true` di `user_features`.

## Guest Mode Berlaku Untuk

- Commercial Invoice (`invoice.html`)
- Packing List (`packinglist.html`)

Master Data (Companies/Products), History, dan Admin Panel tetap
membutuhkan login — guest mode hanya berlaku untuk alur pembuatan dokumen
baru.

## Batasan MVP

- Free tier (hasil self-signup): **unlimited** dokumen untuk MVP. Limit
  per akun dapat ditambahkan di fase monetisasi (lihat §15, §60, §61)
  tanpa mengubah arsitektur ini.
- Verifikasi email **tidak diwajibkan** sebelum dapat menyimpan/download
  (prioritas minim friksi). Dapat diaktifkan kapan saja lewat pengaturan
  Supabase Auth (`Confirm email`) bila terjadi penyalahgunaan, tanpa perlu
  mengubah kode aplikasi.