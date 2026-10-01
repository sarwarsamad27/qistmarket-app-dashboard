// Column layout of the Legacy Import sheet — shared by the import page (which
// reads a sheet by POSITION in this order) and the Accounts Master Sheet export
// (which writes one in this order), so an exported master sheet always lines up
// column-for-column with the import template. Add new columns at the END only:
// sheets prepared in an older layout must still line up.
export const LEGACY_COLUMNS = [
  // Sale basics
  'order_date', 'bill_id',
  // Purchaser — Customer Information card
  'purchaser_name', 'purchaser_cnic', 'purchaser_phone', 'purchaser_alt_contact',
  'purchaser_city', 'purchaser_area', 'purchaser_zone', 'purchaser_house_street',
  'purchaser_gender', 'purchaser_residential_type',
  // Purchaser — Purchaser Details section (employment/business profile)
  'purchaser_father_husband_name', 'purchaser_job_type',
  'purchaser_employer_name', 'purchaser_employer_address', 'purchaser_designation', 'purchaser_official_number',
  'purchaser_business_name', 'purchaser_established_since', 'purchaser_business_address',
  'purchaser_net_income', 'purchaser_years_in_company', 'purchaser_gross_salary', 'purchaser_nearest_location',
  // Item / installment plan
  'item_price', 'item_model', 'serial', 'tenure_months', 'advance', 'installment',
  // Guarantor 1 — Grantor Details section
  'grantor1_name', 'grantor1_cnic', 'grantor1_phone', 'grantor1_father_husband_name', 'grantor1_relationship',
  'grantor1_job_type', 'grantor1_designation', 'grantor1_official_number',
  'grantor1_office_address', 'grantor1_company_name', 'grantor1_years_in_company', 'grantor1_monthly_income',
  'grantor1_business_name', 'grantor1_established_since', 'grantor1_business_address', 'grantor1_net_income',
  'grantor1_full_residential_address', 'grantor1_nearest_location',
  // Guarantor 2 — same shape as Guarantor 1
  'grantor2_name', 'grantor2_cnic', 'grantor2_phone', 'grantor2_father_husband_name', 'grantor2_relationship',
  'grantor2_job_type', 'grantor2_designation', 'grantor2_official_number',
  'grantor2_office_address', 'grantor2_company_name', 'grantor2_years_in_company', 'grantor2_monthly_income',
  'grantor2_business_name', 'grantor2_established_since', 'grantor2_business_address', 'grantor2_net_income',
  'grantor2_full_residential_address', 'grantor2_nearest_location',
  // Next of Kin — optional, matches the order detail page's Next of Kin
  // Details section (a distinct, single record, not per-guarantor).
  'next_of_kin_name', 'next_of_kin_cnic', 'next_of_kin_relation', 'next_of_kin_phone',
  // PAY1-4 columns were dropped — the paper ledgers kept them inconsistently
  // (often blank even when the running balance was accurate), so `remain`
  // is now the sole basis for working out how many months are paid.
  'remain',
  // Product category — same list a normal order/inventory item picks from
  // (/api/products category_name). Appended LAST rather than next to the
  // item columns so sheets already prepared in the older layout still line
  // up column-for-column; a blank cell falls back to the page's Default
  // Category dropdown.
  'category',
  // Assignment "who & where" + timeline dates — the same fields the order page's
  // Edit Timeline modal edits. Also appended at the end so older sheets still line
  // up. Officers: username or full name. Outlet: code (e.g. GB-001) or exact name.
  // Blank = importing admin / the sale DATE, same as before these columns existed.
  'verification_officer', 'delivery_officer', 'recovery_officer', 'outlet',
  'verification_assigned_at', 'delivery_assigned_at', 'recovery_assigned_at', 'delivered_at',
] as const;

export type LegacyColumn = (typeof LEGACY_COLUMNS)[number];

export const LEGACY_DATE_COLUMNS: LegacyColumn[] = ['order_date', 'verification_assigned_at', 'delivery_assigned_at', 'recovery_assigned_at', 'delivered_at'];

// Header row of the sheet, one per LEGACY_COLUMNS entry, same order.
export const LEGACY_HEADERS: string[] = [
  'DATE', '1BILL ID',
  'Name', 'CNIC', 'Contact No.', 'Alternate Contact',
  'City', 'Area', 'Zone', 'House No / Street', 'Gender', 'Residential Type',
  "Father/Husband Name", 'Job Type',
  'Employer Name', 'Employer Address', 'Designation', 'Official Number',
  'Business Name', 'Established Since', 'Business Address',
  'Net Income', 'Years in Company', 'Gross Salary', 'Nearest Location',
  'ITEM PRICE', 'ITEM MODEL', 'SERIAL', 'Tenure', 'ADVANCE', 'INSTALLMENT',
  "Guarantor 1 Name", 'Guarantor 1 CNIC', 'Guarantor 1 Contact', 'Guarantor 1 Father/Husband Name', 'Guarantor 1 Relationship',
  'Guarantor 1 Job Type', 'Guarantor 1 Designation', 'Guarantor 1 Official Number',
  'Guarantor 1 Office Address', 'Guarantor 1 Company Name', 'Guarantor 1 Years in Company', 'Guarantor 1 Monthly Income',
  'Guarantor 1 Business Name', 'Guarantor 1 Established Since', 'Guarantor 1 Business Address', 'Guarantor 1 Net Income',
  'Guarantor 1 Full Residential Address', 'Guarantor 1 Nearest Location',
  "Guarantor 2 Name", 'Guarantor 2 CNIC', 'Guarantor 2 Contact', 'Guarantor 2 Father/Husband Name', 'Guarantor 2 Relationship',
  'Guarantor 2 Job Type', 'Guarantor 2 Designation', 'Guarantor 2 Official Number',
  'Guarantor 2 Office Address', 'Guarantor 2 Company Name', 'Guarantor 2 Years in Company', 'Guarantor 2 Monthly Income',
  'Guarantor 2 Business Name', 'Guarantor 2 Established Since', 'Guarantor 2 Business Address', 'Guarantor 2 Net Income',
  'Guarantor 2 Full Residential Address', 'Guarantor 2 Nearest Location',
  'Next of Kin Name', 'Next of Kin CNIC', 'Next of Kin Relation', 'Next of Kin Phone',
  'remain',
  'Category',
  'Verification Officer', 'Delivery Officer', 'Recovery Officer', 'Outlet',
  'Verification Assigned Date', 'Delivery Assigned Date', 'Recovery Assigned Date', 'Delivered Date',
];
