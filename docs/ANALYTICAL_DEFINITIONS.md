# DATAPRISM: Analytical Definitions & Demonstration Dataset

## Demonstration Dataset: UCI Online Retail II
- **Source:** UCI Machine Learning Repository (Online Retail II dataset).
- **Domain:** E-commerce non-store transactional records.
- **Attributes:**
  - `Invoice`: 6-digit transaction identifier. Codes starting with 'C' denote cancellations.
  - `StockCode`: 5-digit product code.
  - `Description`: Item description.
  - `Quantity`: Quantities of product per transaction.
  - `InvoiceDate`: Timestamp of invoice generation.
  - `Price`: Unit price in Sterling (£).
  - `CustomerID`: 5-digit unique customer identifier.
  - `Country`: Customer residential country.

## Metric Catalog Standards

### 1. Gross Revenue
- **Definition:** Total gross sales amount before deducting returns.
- **Formula:** `SUM(CASE WHEN Quantity > 0 AND Price > 0 AND Invoice NOT LIKE 'C%' THEN Quantity * Price ELSE 0 END)`
- **Grain:** Transaction line item.
- **Unit:** Currency (GBP £).
- **Limitations:** Excludes cancelled transactions and inventory adjustments.

### 2. Net Revenue
- **Definition:** Total sales net of cancellations.
- **Formula:** `SUM(CASE WHEN Price > 0 THEN Quantity * Price ELSE 0 END)`
- **Grain:** Transaction line item.
- **Limitations:** Treats negative quantities as return debits.

### 3. Active Customer Count
- **Definition:** Number of distinct non-null customers with completed transactions.
- **Formula:** `COUNT(DISTINCT CustomerID)`
- **Grain:** Distinct CustomerID.
- **Exclusions:** Guest checkouts where CustomerID is null.

### 4. Average Order Value (AOV)
- **Definition:** Total gross revenue divided by count of distinct non-cancelled invoices.
- **Formula:** `Gross Revenue / COUNT(DISTINCT CASE WHEN Quantity > 0 AND Invoice NOT LIKE 'C%' THEN Invoice END)`
- **Unit:** Currency per invoice.

### 5. Return Rate
- **Definition:** Proportion of transactions marked as cancelled.
- **Formula:** `COUNT(DISTINCT CASE WHEN Invoice LIKE 'C%' THEN Invoice END) * 100.0 / COUNT(DISTINCT Invoice)`
- **Unit:** Percentage (%).
