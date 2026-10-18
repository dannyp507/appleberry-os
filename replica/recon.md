# Recon map: Cellstore (web, browser POS)

Scope: everything AppleBerry staff use day to day in Cellstore, so appleberry-os can replace it.
For: AppleBerry's own shops (appleberrygq, AppleBerry Care Centre / appleberryels). Staff must be able to switch with little or no retraining.
Date: 2026-10-18
Method: read-only walk through Daniel's own Cellstore account at normal speed, with Daniel present (terms checked by Daniel). Nothing was saved, edited or deleted. No customer data is recorded here.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | own account | https://appleberrygq.cellstore.co/Home | every module and settings page opened |
| 2 | vendor site | https://cellstore.co | feature list, $39/month flat; Cloudflare blocks automated reading of the other pages |
| 3 | GetApp listing | https://www.getapp.com/retail-consumer-services-software/a/cellstore-software/ | feature summary |
| 4 | Capterra listing | https://www.capterra.com.au/software/157041/cellstore-software | 4.6/5 from 31 reviews |

## Core loop

Customer walks in → repair ticket created → tech works it through statuses → parts and services added → deposit or full payment at the Cash Register → VAT-inclusive invoice → cashed up at End of Day.

## Staff familiarity: what staff are used to

This matters more than feature count. Match these so muscle memory carries over.

### Navigation
- **Left rail, always visible, 8 items in this order:** Cash Register, Repairs, Invoices, Customers, Products, Purchase Orders, Orders, Devices Inventory.
- **Home (the logo) is a grid of 18 tiles:** Stock Take, Expenses, Inventory Transfer, Dashboard, End of Day, Appointment Calendar, Staff Employee, Website, Sales Reports, Repairs Reports, Inventory Reports, Activity Log, Getting Started, Manage Data, Setup, Integrations.
- Top bar: global search, Support, clock, user menu (My Information, Logout).
- appleberry-os today: one sidebar with 15 items in a different order (Dashboard, Campaigns, Cash Register, Repairs, ...). Home is the Dashboard, not a tile grid. **Gap.**

### Words and numbers staff know
| thing | Cellstore | appleberry-os today |
| --- | --- | --- |
| repair statuses | New, Assigned, Waiting on Customer, Estimate, Finished, Invoiced, Cancelled, Closed (list defaults to "Open") | Booked In, Awaiting Quote Approval, In Progress, Ready for Collection, Collected |
| ticket number | t112 (sequential) | R-20261018-AB12 (date + random) |
| invoice number | s568 (sequential) | INV-20261018-AB12C (date + random) |
| VAT line | "Vat (15% Inclusive)" = total × 15/115 | "Vat (15%)" = total × 0.15 (**wrong**) |
| need/have | "Need/Have/OnPO" column on products and cart | stock only |

### List columns (left to right)
| screen | Cellstore | appleberry-os today |
| --- | --- | --- |
| Repairs | Name, Ticket, Model/Brand/More info, Tech, Problem, Created, Due, Status, Last Update | Ticket, Customer, Device, Status, Technician, Problem, Value, Updated |
| Invoices | Date, Time, Invoice#, Customer Name, Sales Person, Taxable, Taxes, Non Taxable, Total | Invoice, Customer, Date, Payment, Refund, Total, Balance, Actions |
| Customers | Name, Company, Email, Contact No, Secondary Phone | (cards) |
| Products | Manufacturer, Product Name, SKU/Barcode, Category, Selling Price, Need/Have/OnPO | Product, Category, Price, Stock, Actions |
| Devices | Model, Color, GB, Cond, Serial Number, PO #, Date Entered, Invoice # | similar |

Every Cellstore list has the same shape: filter dropdowns along the top, a search box on the right, a create button top right, a page-size picker (auto/15/20/25/50/100/500) and paging at the bottom. Clicking a row opens it.

### Look
Light theme, dark left rail, blue primary buttons, yellow "Create X" buttons, an orange or red outline "Clear Sale". appleberry-os mixes a dark POS (#141416) with light repair screens. Pick one. Light is closer to what staff know.

## Screens

| ID | screen | route | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Home | /Home | launcher | 18 tiles + left rail | filled |
| S02 | Cash Register | /POS/index | sell | sales person picker, customer search + New, scan/search item, + custom item, product grid, cart (Need/Have/OnPO, Time/Qty, Unit Price), Taxable/VAT/Grand Total, Clear Sale, Checkout & Complete, Activity Log + Digital Signature + Note | empty cart |
| S03 | Repairs list | /Repairs/lists | queue | sort, status filter (default Open), tech filter, search, Create Ticket | filled |
| S04 | New Repair | /Repairs/add | intake | numbered steps: customer → device (name or IMEI) → problem (pick list) → services & parts (+ general service, product picker) → storage location, password + lock pattern, due date + time, form (Repairs IN/out), Start as Estimate | empty |
| S05 | Repair ticket | /Repairs/edit?repairs_id= | work the job | status dropdown, tech picker, print menu (Full Page, Thermal, Email Ticket, Ticket Label, Customer Label), device + problem card, Repair Forms, customer card, cart, Take Deposit, Complete, Activity Log (Notes / Repairs Created / Track Edits) | filled |
| S06 | Invoices list | /Invoices/lists | history | sort, type (All/Refunds/Unpaid), sales person, search | filled |
| S07 | Invoice view | /Invoices/view?invoice_no= | receipt | customer info, order info (ticket link, sales person), lines with product links, Taxable/VAT/Grand Total, payment line, Create Refund, Print, Activity Log | filled |
| S08 | Customers | /Customers/lists | CRM | All/Archived/Payment Terms, sort, customer type, CRM button, Create Customer | filled |
| S09 | Products | /Products/lists | catalogue | All/Available/Low Stock/Archived, manufacturer, category, Create Product, row Edit/Label/Archive | filled |
| S10 | Purchase Orders | /Purchase_orders/lists | buying | Open/Closed/Returns/Unpaid, supplier; columns incl. Lot Ref, shipping, expected, return | filled |
| S11 | Orders | /Orders/lists | quotes, deposits, layaway | Open/New/Quotes/Waiting on Customer; Amount Paid, Current Due | empty |
| S12 | Devices Inventory | /IMEI/lists | serialized stock | in/not in inventory, model, colour, condition | filled |
| S13 | Stock Take | /Stock_Take | counts | status, date sort, Create Stock Take | filled |
| S14 | Expenses | /Expenses | costs | vendor, expense type, date range, P&L Statement, Create Expense | filled |
| S15 | Inventory Transfer | /Inventory_Transfer | between shops | from/to, status | filled |
| S16 | Dashboard | /Dashboard | KPIs | Today…Last Month, date range, Sales/Repairs/Customers cards with sparklines, sales over time, payments by type, categories, low inventory | empty (today) |
| S17 | End of Day | /End_of_Day | cash-up | date, cash counted (+ drawer counter), starting balance, calculated cash, comments, Save, End of Day List, Print, payment list, store credit list | empty |
| S18 | Appointment Calendar | /Appointment_Calendar | bookings | day grid, days in view 1–7, start/end hour | empty |
| S19 | Staff Employee | /Staff_Employee | users | name, email, employee number, PIN, Disable Time Clock, Create Employee | filled |
| S20 | Website | /Website | public site + widgets | widgets: repair status, add customer, appointment, contact, services, products, devices, request quote; hosted site toggle | disabled |
| S21 | Sales Reports | /Sales_reports | reports | by Date, Sales Person, Customer, Payments by Type, Product, Category, Tax, Unpaid Invoices; Daily/Weekly/Monthly | — |
| S22 | Repairs Reports | /Repairs_reports | reports | by status, by problem, by technician, tickets created | — |
| S23 | Inventory Reports | /Inventory_reports | reports | Inventory Value, Inventory Purchased, Products Report, Purchase Orders | — |
| S24 | Activity Log | /Activity_Feed | audit | activity type, user, date range | filled |
| S25 | Getting Started | /Getting_Started | setup | company info, taxes, payment options, import customers/products, label printer, currency/time zone/date format/language | — |
| S26 | Manage Data | /Manage_Data | lookups + export | suppliers, categories, manufacturers, repair problems, brand models, vendors, expense types, customer types, conditional prices, commissions, GDPR; export by filters + fields | — |
| S27 | Setup | /Settings/* | settings | barcode labels, restrict access (IP), device conditions, custom fields per module, cash register (require customer, no-sale drawer, petty cash, CFD), counting cash, multiple drawers, invoice/order/repair print layouts (general/large/thermal), custom statuses, repair notifications (subject/email/SMS per status), repair forms (in/out, public, required) | — |
| S28 | Integrations | /Integrations | SMS | provider key/secret, country code, number, sender ID, webhook, strip leading zero | — |

## Flows

```
F01 Walk-in repair intake
    S03 → Create Ticket → S04 (customer, device, problem, parts, password, due, form) → Create Repair Ticket → S05
    edge: new customer mid-flow, device found by IMEI, start as estimate

F02 Work and finish a repair
    S05 status New → Assigned → Waiting on Customer → Finished (email/SMS fires per status) → add parts → Take Deposit

F03 Collect and pay
    S05 Complete → S02 with ticket loaded → Checkout & Complete → S07 invoice (status becomes Invoiced)
    edge: split payment, partial payment (unpaid invoice), deposit already taken

F04 Counter sale
    S02 scan item → customer optional → Checkout & Complete → S07

F05 Refund
    S07 Create Refund → refund invoice (Invoices filter "Refunds")

F06 Cash up
    S17 count cash (drawer counter) + starting balance → compare calculated → comment → Save → End of Day List

F07 Restock
    S10 Create PO → receive → stock + Need/Have/OnPO update; S13 stock take; S15 transfer between shops
```

## Inferred data model (differences from appleberry-os only)

```
Repair    + due_at, storage_location, is_estimate, forms[] (in/out answers), deposits
          evidence: S04 fields, S05 Take Deposit   confidence: high
Invoice   sequential number (s###), taxable, taxes, non_taxable, sales_person, payments[] with type
          evidence: S06 columns, S07                confidence: high
EndOfDay  date, starting_balance, cash_counted, calculated_cash, comments, user
          evidence: S17                             confidence: high
Order     quote | deposit | layaway, amount_paid, current_due, status
          evidence: S11                             confidence: medium
Product   + manufacturer, on_po_qty, archived
          evidence: S09                             confidence: high
Employee  + employee_number, pin, time clock
          evidence: S19                             confidence: high
```

## Feature matrix

See `features.csv`: 69 scored rows. Parity today is **65 / 100**, with 18 of 25 must-haves done. Full output: `python3 ~/.claude/skills/replica-diff/parity.py replica/features.csv`.

## Solidity problems found in appleberry-os

| # | severity | problem | where |
| --- | --- | --- | --- |
| 1 | S1 | VAT worked out as total × 0.15 on VAT-inclusive prices. It overstates VAT by about 15% on every sale (R4,300 → R645.00 instead of R560.87), and the wrong figure is saved to `sales.tax_amount` | src/pages/POS.tsx:331 |
| 2 | S1 | SMTP password and WhatsApp access token can be read by any staff member's browser (rules allow `get` for any staff; PostSaleModal reads them, but the server already sends) | firestore.rules:149, src/components/pos/PostSaleModal.tsx:82,125 |
| 3 | S2 | Invoice and ticket numbers are date + random, not sequential. That's awkward for VAT records and staff | src/lib/business.ts:14-26 |
| 4 | S2 | End of Day is never saved: no close record, no starting balance, no history | src/pages/EndOfDay.tsx |
| 5 | S2 | Any staff member can create a sale or change repair money fields (paid_amount, payments) without the pos.use permission; totals are trusted from the browser | firestore.rules:203, 263 |
| 6 | S3 | "Add Digital Signature" and "Add New Note" buttons do nothing | src/pages/POS.tsx:1063, src/pages/RepairDetail.tsx:569 |
| 7 | to check | The public invoice link (/view-invoice/:id) reads Firestore from the browser, but the rules require a staff login, so a customer probably sees nothing | src/pages/InvoiceView.tsx |

## Out of scope

- Cellstore's data itself (568 invoices, 1,166 products, customers) comes over by **migration**, not cloning. Manage Data → Export, then appleberry-os Import.
- The Cellstore name and logo. appleberry-os keeps the AppleBerry brand.

## Size

28 screens, 7 flows, 6 changed entities. Hard parts: correct VAT and sequential numbering (needs a server-side counter), deposits and layaway that flow through to invoices and End of Day, and print layouts (thermal and labels). Size: **M** (a few weeks) to reach staff-ready parity. The S1 fixes are about a day.
